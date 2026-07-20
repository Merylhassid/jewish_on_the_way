import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageLike } from './chat-message-like.entity';
import { ChatCursor } from './chat-cursor.entity';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';
import { Minyan } from '../minyan.entity';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from '../reports/reports.service';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_STALE_MS = RATE_LIMIT_WINDOW_MS * 2;
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const CORS_ORIGIN =
  process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : '*';

type SimpleUser = { userId: number; firstName: string; lastName: string };
type CommunityCategory =
  | 'hotels'
  | 'attractions'
  | 'food'
  | 'flights'
  | 'entertainment'
  | 'transport'
  | 'synagogues'
  | 'general';

const COMMUNITY_CATEGORIES = new Set<CommunityCategory>([
  'hotels',
  'attractions',
  'food',
  'flights',
  'entertainment',
  'transport',
  'synagogues',
  'general',
]);

@WebSocketGateway({
  cors: { origin: CORS_ORIGIN },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Rate limiting
  private readonly msgRateMap = new Map<
    number,
    { count: number; windowStart: number; lastSeen: number }
  >();
  private cleanupInterval: ReturnType<typeof setInterval>;

  // Online presence: socketId → user info
  private readonly socketUsers = new Map<string, SimpleUser>();
  // roomKey → Set<userId> (deduplicated)
  private readonly roomPresence = new Map<string, Set<number>>();
  // socketId → Set<roomKey>
  private readonly socketRooms = new Map<string, Set<string>>();
  // Resolves when handleConnection finishes auth — prevents race with handleJoin
  private readonly connectionReady = new Map<string, Promise<void>>();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(ChatMessage)
    private messagesRepo: Repository<ChatMessage>,
    @InjectRepository(ChatMessageLike)
    private likesRepo: Repository<ChatMessageLike>,
    @InjectRepository(ChatCursor)
    private cursorsRepo: Repository<ChatCursor>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    private audit: AuditService,
    private reports: ReportsService,
  ) {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - RATE_LIMIT_STALE_MS;
      for (const [userId, entry] of this.msgRateMap) {
        if (entry.lastSeen < cutoff) this.msgRateMap.delete(userId);
      }
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  async handleConnection(client: Socket) {
    const authPromise = (async () => {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');

      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
      if (!user) throw new Error('User not found');

      (client as any).userId = user.id;
      (client as any).cachedUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      };
      this.socketUsers.set(client.id, {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      this.logger.log(`Client connected: ${client.id} (user ${user.id})`);
    })();

    // Store a non-rejecting version so awaiting it in handleJoin is safe
    this.connectionReady.set(client.id, authPromise.catch(() => {}));

    try {
      await authPromise;
    } catch {
      this.logger.warn(`Rejected connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectionReady.delete(client.id);
    const userId = (client as any).userId;
    if (userId) this.msgRateMap.delete(userId);

    // Clean up presence
    const rooms = this.socketRooms.get(client.id);
    if (rooms) {
      for (const room of rooms) {
        this.removeFromPresence(client.id, room);
        this.broadcastOnline(room);
      }
      this.socketRooms.delete(client.id);
    }
    this.socketUsers.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── City Chat: Join ──
  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number },
  ) {
    // Wait for handleConnection to finish (guards against the async race condition)
    await this.connectionReady.get(client.id);
    if (!(client as any).userId) throw new WsException('Unauthorized');

    const destination = await this.destinationsRepo.findOne({ where: { id: data.destinationId } });
    if (!destination) throw new WsException('Destination not found');
    (client as any).destinationId = destination.id;

    const room = `destination:${destination.id}`;
    await client.join(room);
    this.addToPresence(client.id, room);
    this.broadcastOnline(room);

    const history = await this.messagesRepo.find({
      where: { destination: { id: destination.id }, parentMessage: IsNull() },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: ['comments', 'comments.user'],
    });
    client.emit('chat:history', await this.formatCommunityMessages(history, (client as any).userId));

    // Send current read cursors
    const cursors = await this.getCursors(room);
    client.emit('chat:cursors', { cursors });

    // Send online count directly to joining client in addition to broadcast
    client.emit('chat:online', { count: this.roomPresence.get(room)?.size ?? 0 });

    return { ok: true };
  }

  // ── City Chat: Leave ──
  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number },
  ) {
    const room = `destination:${data.destinationId}`;
    await client.leave(room);
    this.removeFromPresence(client.id, room);
    this.broadcastOnline(room);
    return { ok: true };
  }

  // ── City Chat: Send ──
  @SubscribeMessage('chat:sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; content: string; category?: string; parentMessageId?: number; imageUrl?: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) throw new WsException('Message must be 1–500 characters');

    const cachedUser = (client as any).cachedUser as User;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!cachedUser || !cachedDestinationId) throw new WsException('Invalid destination');

    const category = this.normalizeCommunityCategory(data.category);
    const parentMessageId = Number(data.parentMessageId || 0) || null;
    let parentMessage: ChatMessage | null = null;
    if (parentMessageId) {
      parentMessage = await this.messagesRepo.findOne({
        where: {
          id: parentMessageId,
          destination: { id: cachedDestinationId },
          parentMessage: IsNull(),
        },
      });
      if (!parentMessage) throw new WsException('Parent post not found');
    }

    const message = this.messagesRepo.create({
      content,
      category: parentMessage ? parentMessage.category : category,
      imageUrl: parentMessage ? null : (data.imageUrl ?? null),
      user: cachedUser,
      destination: { id: cachedDestinationId } as Destination,
      parentMessage,
    });
    const saved = await this.messagesRepo.save(message);
    saved.user = cachedUser;

    const room = `destination:${cachedDestinationId}`;
    if (parentMessage) {
      saved.parentMessage = parentMessage;
      const formatted = this.formatMessage(saved);
      this.server.to(room).emit('chat:newComment', { parentMessageId: parentMessage.id, comment: formatted });
    } else {
      const formatted = (await this.formatCommunityMessages([saved], userId))[0];
      this.server.to(room).emit('chat:newMessage', formatted);
    }

    // Auto-mark sender as read
    await this.upsertCursor(room, userId, cachedUser.firstName, cachedUser.lastName, saved.id);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('chat:cursors', { cursors });

    this.audit.log('CHAT_MESSAGE_SENT', userId, { destinationId: cachedDestinationId });
    return this.formatMessage(saved);
  }

  // ── City Chat: Mark Read ──
  @SubscribeMessage('chat:mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; lastReadId: number },
  ) {
    const userId = (client as any).userId;
    const cachedUser = (client as any).cachedUser as User;
    if (!userId || !cachedUser) return;

    const room = `destination:${data.destinationId}`;
    await this.upsertCursor(room, userId, cachedUser.firstName, cachedUser.lastName, data.lastReadId);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('chat:cursors', { cursors });
    return { ok: true };
  }

  @SubscribeMessage('chat:toggleLike')
  async handleToggleLike(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; messageId: number },
  ) {
    const userId = (client as any).userId;
    const cachedUser = (client as any).cachedUser as User;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!userId || !cachedUser || !cachedDestinationId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const message = await this.messagesRepo.findOne({
      where: {
        id: data.messageId,
        destination: { id: cachedDestinationId },
        parentMessage: IsNull(),
      },
    });
    if (!message) throw new WsException('Post not found');

    const existing = await this.likesRepo.findOne({
      where: { message: { id: message.id }, user: { id: userId } },
    });
    if (existing) {
      await this.likesRepo.remove(existing);
    } else {
      await this.likesRepo.save(this.likesRepo.create({ message, user: cachedUser }));
    }

    const engagement = await this.getLikesForMessages([message.id], userId);
    const likes = engagement.get(message.id) ?? { likeCount: 0, likedByMe: false, likedBy: [] };
    const room = `destination:${cachedDestinationId}`;
    this.server.to(room).emit('chat:likesUpdated', { messageId: message.id, ...likes });
    return { messageId: message.id, ...likes };
  }

  @SubscribeMessage('chat:updatePost')
  async handleUpdatePost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; messageId: number; content: string },
  ) {
    const userId = (client as any).userId;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!userId || !cachedDestinationId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) throw new WsException('Post must be 1–500 characters');

    const message = await this.messagesRepo.findOne({
      where: {
        id: data.messageId,
        destination: { id: cachedDestinationId },
        user: { id: userId },
        parentMessage: IsNull(),
      },
      relations: ['comments', 'comments.user'],
    });
    if (!message) throw new WsException('Post not found');

    message.content = content;
    const saved = await this.messagesRepo.save(message);
    const formatted = (await this.formatCommunityMessages([saved], userId))[0];
    const room = `destination:${cachedDestinationId}`;
    this.server.to(room).emit('chat:postUpdated', { message: formatted });
    return formatted;
  }

  @SubscribeMessage('chat:deletePost')
  async handleDeletePost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; messageId: number },
  ) {
    const userId = (client as any).userId;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!userId || !cachedDestinationId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const message = await this.messagesRepo.findOne({
      where: {
        id: data.messageId,
        destination: { id: cachedDestinationId },
        user: { id: userId },
        parentMessage: IsNull(),
      },
    });
    if (!message) throw new WsException('Post not found');

    await this.messagesRepo.remove(message);
    const room = `destination:${cachedDestinationId}`;
    this.server.to(room).emit('chat:postDeleted', { messageId: data.messageId });
    return { ok: true, messageId: data.messageId };
  }

  @SubscribeMessage('chat:updateComment')
  async handleUpdateComment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; commentId: number; content: string },
  ) {
    const userId = (client as any).userId;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!userId || !cachedDestinationId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) throw new WsException('Comment must be 1–500 characters');

    const comment = await this.messagesRepo.findOne({
      where: {
        id: data.commentId,
        destination: { id: cachedDestinationId },
        user: { id: userId },
      },
      relations: ['parentMessage'],
    });
    if (!comment?.parentMessage) throw new WsException('Comment not found');

    comment.content = content;
    const saved = await this.messagesRepo.save(comment);
    saved.parentMessage = comment.parentMessage;
    const formatted = this.formatMessage(saved);
    const room = `destination:${cachedDestinationId}`;
    this.server.to(room).emit('chat:commentUpdated', {
      parentMessageId: comment.parentMessage.id,
      comment: formatted,
    });
    return formatted;
  }

  @SubscribeMessage('chat:deleteComment')
  async handleDeleteComment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; commentId: number },
  ) {
    const userId = (client as any).userId;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!userId || !cachedDestinationId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const comment = await this.messagesRepo.findOne({
      where: {
        id: data.commentId,
        destination: { id: cachedDestinationId },
        user: { id: userId },
      },
      relations: ['parentMessage'],
    });
    if (!comment?.parentMessage) throw new WsException('Comment not found');

    const parentMessageId = comment.parentMessage.id;
    await this.messagesRepo.remove(comment);
    const room = `destination:${cachedDestinationId}`;
    this.server.to(room).emit('chat:commentDeleted', {
      parentMessageId,
      commentId: data.commentId,
    });
    return { ok: true, parentMessageId, commentId: data.commentId };
  }

  // ── Minyan Chat: Join ──
  @SubscribeMessage('minyan-chat:join')
  async handleMinyanJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
    // Wait for handleConnection to finish (guards against the async race condition)
    await this.connectionReady.get(client.id);
    if (!(client as any).userId) throw new WsException('Unauthorized');

    const room = `minyan-chat:${data.minyanId}`;
    (client as any).minyanId = data.minyanId;
    await client.join(room);
    this.addToPresence(client.id, room);
    this.broadcastOnline(room);

    const history = await this.messagesRepo.find({
      where: { minyan: { id: data.minyanId } },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    client.emit('minyan-chat:history', history.map(this.formatMessage));

    const cursors = await this.getCursors(room);
    client.emit('minyan-chat:cursors', { cursors });

    // Send online count directly to joining client in addition to broadcast
    client.emit('chat:online', { count: this.roomPresence.get(room)?.size ?? 0 });

    return { ok: true };
  }

  // ── Minyan Chat: Leave ──
  @SubscribeMessage('minyan-chat:leave')
  async handleMinyanLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
    const room = `minyan-chat:${data.minyanId}`;
    await client.leave(room);
    this.removeFromPresence(client.id, room);
    this.broadcastOnline(room);
    return { ok: true };
  }

  // ── Minyan Chat: Send ──
  @SubscribeMessage('minyan-chat:sendMessage')
  async handleMinyanMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number; content: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) throw new WsException('Message must be 1–500 characters');

    const cachedUser = (client as any).cachedUser as User;
    const minyanId = data.minyanId ?? (client as any).minyanId;
    if (!cachedUser || !minyanId) throw new WsException('Invalid minyan');

    const message = this.messagesRepo.create({
      content,
      user: cachedUser,
      minyan: { id: minyanId } as Minyan,
      destination: null,
    });
    const saved = await this.messagesRepo.save(message);
    saved.user = cachedUser;

    const formatted = this.formatMessage(saved);
    const room = `minyan-chat:${minyanId}`;
    this.server.to(room).emit('minyan-chat:newMessage', formatted);

    await this.upsertCursor(room, userId, cachedUser.firstName, cachedUser.lastName, saved.id);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('minyan-chat:cursors', { cursors });

    this.audit.log('CHAT_MESSAGE_SENT', userId, { minyanId });
    return formatted;
  }

  // ── Minyan Chat: Mark Read ──
  @SubscribeMessage('minyan-chat:mark-read')
  async handleMinyanMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number; lastReadId: number },
  ) {
    const userId = (client as any).userId;
    const cachedUser = (client as any).cachedUser as User;
    if (!userId || !cachedUser) return;

    const room = `minyan-chat:${data.minyanId}`;
    await this.upsertCursor(room, userId, cachedUser.firstName, cachedUser.lastName, data.lastReadId);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('minyan-chat:cursors', { cursors });
    return { ok: true };
  }

  // ── City Chat: Typing ──
  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number },
  ) {
    const userId = (client as any).userId;
    const cachedUser = (client as any).cachedUser as User;
    if (!userId || !cachedUser) return;
    const room = `destination:${data.destinationId}`;
    this.server.except(client.id).to(room).emit('chat:typing', { userId, firstName: cachedUser.firstName });
  }

  @SubscribeMessage('chat:stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;
    const room = `destination:${data.destinationId}`;
    this.server.except(client.id).to(room).emit('chat:stop-typing', { userId });
  }

  // ── Minyan Chat: Typing ──
  @SubscribeMessage('minyan-chat:typing')
  handleMinyanTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
    const userId = (client as any).userId;
    const cachedUser = (client as any).cachedUser as User;
    if (!userId || !cachedUser) return;
    const room = `minyan-chat:${data.minyanId}`;
    this.server.except(client.id).to(room).emit('chat:typing', { userId, firstName: cachedUser.firstName });
  }

  @SubscribeMessage('minyan-chat:stop-typing')
  handleMinyanStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;
    const room = `minyan-chat:${data.minyanId}`;
    this.server.except(client.id).to(room).emit('chat:stop-typing', { userId });
  }

  // ── Report ──
  @SubscribeMessage('chat:report')
  async handleReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');
    this.logger.warn(`Message #${data.messageId} reported by user #${userId}`);
    this.audit.log('CHAT_MESSAGE_REPORTED', userId, { messageId: data.messageId });

    const message = await this.messagesRepo.findOne({
      where: { id: data.messageId },
      relations: ['user'],
    });
    if (message?.user && message.user.id !== userId) {
      await this.reports.createDirect(userId, message.user.id, 'community', data.messageId);
    }

    return { ok: true };
  }

  // ── Helpers ──

  private checkRateLimit(userId: number) {
    const now = Date.now();
    const rate = this.msgRateMap.get(userId) ?? { count: 0, windowStart: now, lastSeen: now };
    if (now - rate.windowStart > RATE_LIMIT_WINDOW_MS) {
      rate.count = 0;
      rate.windowStart = now;
    }
    rate.count++;
    rate.lastSeen = now;
    this.msgRateMap.set(userId, rate);
    if (rate.count > RATE_LIMIT_MAX) throw new WsException('Too many messages — slow down');
  }

  private addToPresence(socketId: string, room: string) {
    const su = this.socketUsers.get(socketId);
    if (!su) return;
    if (!this.roomPresence.has(room)) this.roomPresence.set(room, new Set());
    this.roomPresence.get(room)!.add(su.userId);
    if (!this.socketRooms.has(socketId)) this.socketRooms.set(socketId, new Set());
    this.socketRooms.get(socketId)!.add(room);
  }

  private removeFromPresence(socketId: string, room: string) {
    const su = this.socketUsers.get(socketId);
    if (!su) return;
    // Only remove userId if no other socket from same user is in this room
    const hasOther = [...this.socketUsers.entries()].some(
      ([sid, u]) => sid !== socketId && u.userId === su.userId && this.socketRooms.get(sid)?.has(room),
    );
    if (!hasOther) this.roomPresence.get(room)?.delete(su.userId);
    this.socketRooms.get(socketId)?.delete(room);
  }

  private broadcastOnline(room: string) {
    const count = this.roomPresence.get(room)?.size ?? 0;
    this.server.to(room).emit('chat:online', { count });
  }

  private async upsertCursor(room: string, userId: number, firstName: string, lastName: string, lastReadId: number) {
    const existing = await this.cursorsRepo.findOne({ where: { roomKey: room, userId } });
    if (existing) {
      if (lastReadId > existing.lastReadId) {
        existing.firstName = firstName;
        existing.lastName = lastName;
        existing.lastReadId = lastReadId;
        await this.cursorsRepo.save(existing);
      }
    } else {
      await this.cursorsRepo.save(
        this.cursorsRepo.create({ roomKey: room, userId, firstName, lastName, lastReadId }),
      );
    }
  }

  private async getCursors(room: string) {
    const rows = await this.cursorsRepo.find({ where: { roomKey: room } });
    return rows.map((c) => ({
      userId: c.userId,
      firstName: c.firstName,
      lastName: c.lastName,
      lastReadId: c.lastReadId,
    }));
  }

  private normalizeCommunityCategory(value?: string): CommunityCategory {
    if (value && COMMUNITY_CATEGORIES.has(value as CommunityCategory)) {
      return value as CommunityCategory;
    }
    return 'general';
  }

  private async getLikesForMessages(messageIds: number[], currentUserId: number) {
    const map = new Map<
      number,
      {
        likeCount: number;
        likedByMe: boolean;
        likedBy: { id: number; firstName: string; lastName: string; profileImageUrl: string | null }[];
      }
    >();
    if (messageIds.length === 0) return map;

    const likes = await this.likesRepo.find({
      where: { message: { id: In(messageIds) } },
      relations: ['message', 'user'],
      order: { createdAt: 'ASC' },
    });

    for (const like of likes) {
      const messageId = like.message.id;
      if (!map.has(messageId)) {
        map.set(messageId, { likeCount: 0, likedByMe: false, likedBy: [] });
      }
      const entry = map.get(messageId)!;
      entry.likeCount++;
      if (like.user.id === currentUserId) entry.likedByMe = true;
      entry.likedBy.push({
        id: like.user.id,
        firstName: like.user.firstName,
        lastName: like.user.lastName,
        profileImageUrl: like.user.profileImageUrl,
      });
    }

    return map;
  }

  private async formatCommunityMessages(messages: ChatMessage[], currentUserId: number) {
    const likes = await this.getLikesForMessages(messages.map((message) => message.id), currentUserId);
    return messages.map((message) => {
      const engagement = likes.get(message.id) ?? { likeCount: 0, likedByMe: false, likedBy: [] };
      return {
        ...this.formatMessage(message),
        category: this.normalizeCommunityCategory(message.category ?? undefined),
        comments: (message.comments ?? [])
          .slice()
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((comment) => this.formatMessage(comment)),
        ...engagement,
      };
    });
  }

  private formatMessage(msg: ChatMessage) {
    return {
      id: msg.id,
      content: msg.content,
      category: msg.category ?? null,
      imageUrl: msg.imageUrl ?? null,
      parentMessageId: msg.parentMessage?.id ?? null,
      createdAt: msg.createdAt,
      user: {
        id: msg.user.id,
        firstName: msg.user.firstName,
        lastName: msg.user.lastName,
        profileImageUrl: msg.user.profileImageUrl,
      },
    };
  }
}
