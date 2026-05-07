import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
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
import { HostingChatMessage } from './entities/hosting-chat-message.entity';
import { HostingRequest } from './entities/hosting-request.entity';
import { AuditService } from '../audit/audit.service';

// req 5.4 extended to hosting chat — 5 msg / 10 s per user
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/hosting-chat',
})
export class HostingChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HostingChatGateway.name);
  private readonly msgRateMap = new Map<
    number,
    { count: number; windowStart: number }
  >();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(HostingChatMessage)
    private messagesRepo: Repository<HostingChatMessage>,
    @InjectRepository(HostingRequest)
    private requestsRepo: Repository<HostingRequest>,
    private audit: AuditService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');
      const payload = await this.jwtService.verifyAsync(token);
      (client as any).userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  // Join a hosting request room — req 7.4.4
  @SubscribeMessage('hosting-chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: number },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');

    // req 7.4.5 — only approved request participants may join
    const request = await this.requestsRepo.findOne({
      where: { id: data.requestId },
      relations: ['user', 'offer', 'offer.user'],
    });

    if (!request || request.status !== 'approved') {
      throw new WsException('Chat not available — request must be approved');
    }

    const isParticipant =
      request.user?.id === userId || request.offer?.user?.id === userId;
    if (!isParticipant)
      throw new WsException('Not a participant of this request');

    const room = `hosting-request:${data.requestId}`;
    await client.join(room);

    // Send last 50 messages as history
    const history = await this.messagesRepo.find({
      where: { request: { id: data.requestId } },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    client.emit(
      'hosting-chat:history',
      history.map((m) => this.fmt(m)),
    );
    return { ok: true };
  }

  @SubscribeMessage('hosting-chat:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: number; content: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) throw new WsException('Unauthorized');

    // Rate limit
    const now = Date.now();
    const rate = this.msgRateMap.get(userId) ?? { count: 0, windowStart: now };
    if (now - rate.windowStart > RATE_LIMIT_WINDOW_MS) {
      rate.count = 0;
      rate.windowStart = now;
    }
    rate.count++;
    this.msgRateMap.set(userId, rate);
    if (rate.count > RATE_LIMIT_MAX)
      throw new WsException('Too many messages — slow down');

    const content = (data.content ?? '').trim();
    if (!content || content.length > 500) {
      throw new WsException('Message must be 1–500 characters');
    }

    const request = await this.requestsRepo.findOne({
      where: { id: data.requestId },
      relations: ['user', 'offer', 'offer.user'],
    });
    if (!request || request.status !== 'approved')
      throw new WsException('Chat unavailable');

    const isParticipant =
      request.user?.id === userId || request.offer?.user?.id === userId;
    if (!isParticipant) throw new WsException('Not a participant');

    const msg = this.messagesRepo.create({
      content,
      request,
      user: { id: userId } as any,
    });
    const saved = await this.messagesRepo.save(msg);

    // Reload to get user relation
    const full = await this.messagesRepo.findOne({
      where: { id: saved.id },
    });

    const formatted = this.fmt(full!);
    this.server
      .to(`hosting-request:${data.requestId}`)
      .emit('hosting-chat:message', formatted);
    this.audit.log('CHAT_MESSAGE_SENT', userId, {
      type: 'hosting',
      requestId: data.requestId,
    });

    return formatted;
  }

  private fmt(msg: HostingChatMessage) {
    return {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      user: msg.user
        ? {
            id: msg.user.id,
            firstName: msg.user.firstName,
            lastName: msg.user.lastName,
          }
        : null,
    };
  }
}
