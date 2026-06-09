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
import { HostingChatMessage } from './entities/hosting-chat-message.entity';
import { HostingRequest } from './entities/hosting-request.entity';
import { ChatCursor } from '../chat/chat-cursor.entity';
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
  namespace: '/hosting-chat',
})
export class HostingChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HostingChatGateway.name);
  private readonly msgRateMap = new Map<
    number,
    { count: number; windowStart: number; lastSeen: number }
  >();
  private cleanupInterval: ReturnType<typeof setInterval>;

  // Online presence
  private readonly socketUsers = new Map<string, SimpleUser>();
  private readonly roomPresence = new Map<string, Set<number>>();
  private readonly socketRooms = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(HostingChatMessage)
    private messagesRepo: Repository<HostingChatMessage>,
    @InjectRepository(HostingRequest)
    private requestsRepo: Repository<HostingRequest>,
    @InjectRepository(ChatCursor)
    private cursorsRepo: Repository<ChatCursor>,
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

      // Hosting chat gateway doesn't have usersRepo — store minimal info from token
      // Full name is fetched lazily on join
      (client as any).userId = payload.sub;
      this.socketUsers.set(client.id, {
        userId: payload.sub,
        firstName: payload.firstName ?? '',
        lastName: payload.lastName ?? '',
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (userId) this.msgRateMap.delete(userId);

    const rooms = this.socketRooms.get(client.id);
    if (rooms) {
      for (const room of rooms) {
        this.removeFromPresence(client.id, room);
        this.broadcastOnline(room);
      }
      this.socketRooms.delete(client.id);
    }
    this.socketUsers.delete(client.id);
  }

  @SubscribeMessage('hosting-chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: number },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');

    const request = await this.requestsRepo.findOne({
      where: { id: data.requestId },
      relations: ['user', 'offer', 'offer.user'],
    });

    if (!request || request.status !== 'approved') {
      throw new WsException('Chat not available — request must be approved');
    }

    const isParticipant =
      request.user?.id === userId ||
      request.offer?.user?.id === userId ||
      request.host_id === userId;
    if (!isParticipant) throw new WsException('Not a participant of this request');

    // Store user name from participants for presence
    const participantUser =
      request.user?.id === userId ? request.user : request.offer?.user;
    if (participantUser) {
      this.socketUsers.set(client.id, {
        userId,
        firstName: participantUser.firstName ?? '',
        lastName: participantUser.lastName ?? '',
      });
      (client as any).cachedUser = {
        firstName: participantUser.firstName ?? '',
        lastName: participantUser.lastName ?? '',
      };
    }

    const room = `hosting-request:${data.requestId}`;
    await client.join(room);
    this.addToPresence(client.id, room);
    this.broadcastOnline(room);

    const history = await this.messagesRepo.find({
      where: { request: { id: data.requestId } },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: 50,
    });
    client.emit('hosting-chat:history', history.map((m) => this.fmt(m)));

    const cursors = await this.getCursors(room);
    client.emit('hosting-chat:cursors', { cursors });

    return { ok: true };
  }

  @SubscribeMessage('hosting-chat:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: number; content: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');

    const now = Date.now();
    const rate = this.msgRateMap.get(userId) ?? { count: 0, windowStart: now, lastSeen: now };
    if (now - rate.windowStart > RATE_LIMIT_WINDOW_MS) { rate.count = 0; rate.windowStart = now; }
    rate.count++;
    rate.lastSeen = now;
    this.msgRateMap.set(userId, rate);
    if (rate.count > RATE_LIMIT_MAX) throw new WsException('Too many messages — slow down');

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) throw new WsException('Message must be 1–500 characters');

    const request = await this.requestsRepo.findOne({
      where: { id: data.requestId },
      relations: ['user', 'offer', 'offer.user'],
    });
    if (!request || request.status !== 'approved') throw new WsException('Chat unavailable');

    const isParticipant =
      request.user?.id === userId ||
      request.offer?.user?.id === userId ||
      request.host_id === userId;
    if (!isParticipant) throw new WsException('Not a participant');

    const msg = this.messagesRepo.create({
      content,
      request,
      user: { id: userId } as any,
    });
    const saved = await this.messagesRepo.save(msg);

    const full = await this.messagesRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const formatted = this.fmt(full!);
    const room = `hosting-request:${data.requestId}`;
    this.server.to(room).emit('hosting-chat:message', formatted);

    // Auto-mark sender as read
    const cu = (client as any).cachedUser;
    await this.upsertCursor(room, userId, cu?.firstName ?? '', cu?.lastName ?? '', saved.id);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('hosting-chat:cursors', { cursors });

    this.audit.log('CHAT_MESSAGE_SENT', userId, { type: 'hosting', requestId: data.requestId });
    return formatted;
  }

  @SubscribeMessage('hosting-chat:mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: number; lastReadId: number },
  ) {
    const userId = (client as any).userId;
    const cu = (client as any).cachedUser;
    if (!userId) return;

    const room = `hosting-request:${data.requestId}`;
    await this.upsertCursor(room, userId, cu?.firstName ?? '', cu?.lastName ?? '', data.lastReadId);
    const cursors = await this.getCursors(room);
    this.server.to(room).emit('hosting-chat:cursors', { cursors });
    return { ok: true };
  }

  // ── Helpers ──

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
    const hasOther = [...this.socketUsers.entries()].some(
      ([sid, u]) => sid !== socketId && u.userId === su.userId && this.socketRooms.get(sid)?.has(room),
    );
    if (!hasOther) this.roomPresence.get(room)?.delete(su.userId);
    this.socketRooms.get(socketId)?.delete(room);
  }

  private broadcastOnline(room: string) {
    const count = this.roomPresence.get(room)?.size ?? 0;
    this.server.to(room).emit('hosting-chat:online', { count });
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

  private fmt(msg: HostingChatMessage) {
    return {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      user: msg.user
        ? { id: msg.user.id, firstName: msg.user.firstName, lastName: msg.user.lastName }
        : null,
    };
  }
}
