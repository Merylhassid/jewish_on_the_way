import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { CandidateSynagogue } from '../candidate-synagogue.entity';
import { PlacesService } from './places.service';
import { WikidataService } from './wikidata.service';
import { CandidateMapperService } from './candidate-mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, Synagogue, CandidateSynagogue]),
    ConfigModule,
  ],
  providers: [PlacesService, WikidataService, CandidateMapperService],
  exports: [PlacesService, WikidataService, CandidateMapperService],
})
export class PlacesModule {}
