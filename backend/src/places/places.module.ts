import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { PlacesService } from './places.service';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant, Synagogue]), ConfigModule],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
