import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaceReview } from './place-review.entity';
import { PlaceReport } from './place-report.entity';
import { PlaceRequest } from './place-request.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { AdminGuard } from '../admin/admin.guard';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlaceReview, PlaceReport, PlaceRequest, User, Restaurant, Synagogue]), MailModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, AdminGuard],
  exports: [ReviewsService],
})
export class ReviewsModule {}
