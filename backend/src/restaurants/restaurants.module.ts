import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from '../restaurant.entity';
import { Destination } from '../destination.entity';
import { SearchFeedback } from '../ai/search-feedback.entity';
import { User } from '../users/user.entity';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, Destination, SearchFeedback, User]),
  ],
  controllers: [RestaurantsController],
  providers: [RestaurantsService, AdminGuard],
})
export class RestaurantsModule {}
