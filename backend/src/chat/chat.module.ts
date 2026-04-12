import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ChatMessage } from './chat-message.entity';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, User, Destination]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
