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
import { Repository } from 'typeorm';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ChatMessage } from './chat-message.entity';
import { ChatCursor } from './chat-cursor.entity';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';
import { Minyan } from '../minyan.entity';
import { AuditService } from '../audit/audit.service';

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

  constructor(
    private jwtService: JwtService,
    @InjectRepository(ChatMessage)
    private messagesRepo: Repository<ChatMessage>,
    @InjectRepository(ChatCursor)
    private cursorsRepo: Repository<ChatCursor>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    private audit: AuditService,
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
    try {
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
    } catch {
      this.logger.warn(`Rejected connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
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
    const destination = await this.destinationsRepo.findOne({ where: { id: data.destinationId } });
    if (!destination) throw new WsException('Destination not found');
    (client as any).destinationId = destination.id;

    const room = `destination:${destination.id}`;
    await client.join(room);
    this.addToPresence(client.id, room);
    this.broadcastOnline(room);

    const history = await this.messagesRepo.find({
      where: { destination: { id: destination.id } },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    client.emit('chat:history', history.map(this.formatMessage));

    // Send current read cursors
    const cursors = await this.getCursors(room);
    client.emit('chat:cursors', { cursors });

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
    @MessageBody() data: { destinationId: number; content: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');
    this.checkRateLimit(userId);

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) throw new WsException('Message must be 1–500 characters');

    const cachedUser = (client as any).cachedUser as User;
    const cachedDestinationId = (client as any).destinationId as number;
    if (!cachedUser || !cachedDestinationId) throw new WsException('Invalid destination');

    const message = this.messagesRepo.create({
      content,
      user: cachedUser,
      destination: { id: cachedDestinationId } as Destination,
    });
    const saved = await this.messagesRepo.save(message);
    saved.user = cachedUser;

    const formatted = this.formatMessage(saved);
    const room = `destination:${cachedDestinationId}`;
    this.server.to(room).emit('chat:newMessage', formatted);

    // Auto-mark sender as read
    await this.upsertCursor(room, userId, cachedUser.firstName, cachedUser.lastName, saved.id);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('chat:cursors', { cursors });

    this.audit.log('CHAT_MESSAGE_SENT', userId, { destinationId: cachedDestinationId });
    return formatted;
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

  // ── Minyan Chat: Join ──
  @SubscribeMessage('minyan-chat:join')
  async handleMinyanJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
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

  // ── Report ──
  @SubscribeMessage('chat:report')
  async handleReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');
    this.logger.warn(`Message #${data.messageId} reported by user #${userId}`);
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

  private formatMessage(msg: ChatMessage) {
    return {
      id: msg.id,
      content: msg.content,
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
