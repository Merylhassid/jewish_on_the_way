import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

const CORS_ORIGIN =
  process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : '*';

@WebSocketGateway({ cors: { origin: CORS_ORIGIN }, namespace: '/minyan' })
export class MinyanGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MinyanGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ??
        String(client.handshake.headers?.authorization ?? '').replace('Bearer ', '');
      this.jwtService.verify(raw);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Minyan WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('minyan:watch')
  handleWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
    void client.join(`minyan:${data.minyanId}`);
  }

  @SubscribeMessage('minyan:unwatch')
  handleUnwatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { minyanId: number },
  ) {
    void client.leave(`minyan:${data.minyanId}`);
  }

  emitUpdate(minyanId: number, payload: Record<string, unknown>) {
    this.server?.to(`minyan:${minyanId}`).emit('minyan:update', payload);
  }
}
