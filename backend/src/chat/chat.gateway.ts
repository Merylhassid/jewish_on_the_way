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
import { Logger } from '@nestjs/common';
import { ChatMessage } from './chat-message.entity';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';
import { AuditService } from '../audit/audit.service';

// req 5.4 — max 5 messages per 10 seconds per user
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;
const CORS_ORIGIN =
  process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : '*';

@WebSocketGateway({
  cors: { origin: CORS_ORIGIN },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // userId → { count, windowStart }
  private readonly msgRateMap = new Map<
    number,
    { count: number; windowStart: number }
  >();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(ChatMessage)
    private messagesRepo: Repository<ChatMessage>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    private audit: AuditService,
  ) {}

  // ── Auth middleware — validate JWT on connection ──
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new Error('No token');

      const payload = await this.jwtService.verifyAsync(token);
      (client as any).userId = payload.sub;
      this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`Rejected connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Join a destination room ──
  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number },
  ) {
    const room = `destination:${data.destinationId}`;
    await client.join(room);
    this.logger.log(`${client.id} joined room ${room}`);

    // Send last 50 messages as history
    const history = await this.messagesRepo.find({
      where: { destination: { id: data.destinationId } },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit('chat:history', history.map(this.formatMessage));
    return { ok: true };
  }

  // ── Leave a destination room ──
  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number },
  ) {
    await client.leave(`destination:${data.destinationId}`);
    return { ok: true };
  }

  // ── Send a message ──
  @SubscribeMessage('chat:sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { destinationId: number; content: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');

    // req 5.4 — rate limit: max 5 messages / 10 s per user
    const now = Date.now();
    const rate = this.msgRateMap.get(userId) ?? { count: 0, windowStart: now };
    if (now - rate.windowStart > RATE_LIMIT_WINDOW_MS) {
      rate.count = 0;
      rate.windowStart = now;
    }
    rate.count++;
    this.msgRateMap.set(userId, rate);
    if (rate.count > RATE_LIMIT_MAX) {
      throw new WsException('Too many messages — slow down');
    }

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) {
      throw new WsException('Message must be 1–500 characters');
    }

    const [user, destination] = await Promise.all([
      this.usersRepo.findOne({ where: { id: userId } }),
      this.destinationsRepo.findOne({ where: { id: data.destinationId } }),
    ]);

    if (!user || !destination) throw new WsException('Invalid destination');

    const message = this.messagesRepo.create({ content, user, destination });
    const saved = await this.messagesRepo.save(message);

    const formatted = this.formatMessage(saved);
    this.server
      .to(`destination:${data.destinationId}`)
      .emit('chat:newMessage', formatted);
    this.audit.log('CHAT_MESSAGE_SENT', userId, {
      destinationId: data.destinationId,
    });

    return formatted;
  }

  // ── Report a message ──
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
