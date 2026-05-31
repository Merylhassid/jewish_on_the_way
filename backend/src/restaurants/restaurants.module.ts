import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from '../restaurant.entity';
import { Destination } from '../destination.entity';
import { SearchFeedback } from '../ai/search-feedback.entity';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { GeocodingService } from '../geocoding/geocoding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, Destination, SearchFeedback]),
  ],
  controllers: [RestaurantsController],
  providers: [RestaurantsService, GeocodingService],
})
export class RestaurantsModule {}
