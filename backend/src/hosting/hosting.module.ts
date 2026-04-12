import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HostingOffer } from './entities/hosting-offer.entity';
import { HostingRequest } from './entities/hosting-request.entity';
import { HostingChatMessage } from './entities/hosting-chat-message.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { HostingController } from './hosting.controller';
import { HostingService } from './hosting.service';
import { HostingChatGateway } from './hosting-chat.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HostingOffer,
      HostingRequest,
      HostingChatMessage,
      Destination,
      User,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [HostingController],
  providers: [HostingService, HostingChatGateway],
})
export class HostingModule {}
