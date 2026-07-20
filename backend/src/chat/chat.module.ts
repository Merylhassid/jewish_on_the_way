import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageLike } from './chat-message-like.entity';
import { ChatCursor } from './chat-cursor.entity';
import { User } from '../users/user.entity';
import { Destination } from '../destination.entity';
import { ReportsModule } from '../reports/reports.module';
import { ChatPublicFeedService } from './chat-public-feed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatMessageLike, ChatCursor, User, Destination]),
    CloudinaryModule,
    ReportsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatPublicFeedService],
})
export class ChatModule {}
