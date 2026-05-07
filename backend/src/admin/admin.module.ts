import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { CandidateSynagogue } from '../candidate-synagogue.entity';
import { User } from '../users/user.entity';
import { ChatMessage } from '../chat/chat-message.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PlacesModule } from '../places/places.module';
import { ManualSynagogueImportService } from './manual-synagogue-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Destination,
      Restaurant,
      Synagogue,
      CandidateSynagogue,
      User,
      ChatMessage,
    ]),
    PlacesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, ManualSynagogueImportService],
})
export class AdminModule {}
