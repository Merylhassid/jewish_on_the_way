import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaceReview } from './place-review.entity';
import { PlaceReport } from './place-report.entity';
import { PlaceRequest } from './place-request.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlaceReview, PlaceReport, PlaceRequest, User])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
