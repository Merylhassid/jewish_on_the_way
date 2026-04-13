import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { User } from '../users/user.entity';
import { ChatMessage } from '../chat/chat-message.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PlacesModule } from '../places/places.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Destination, Restaurant, User, ChatMessage]),
    PlacesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
