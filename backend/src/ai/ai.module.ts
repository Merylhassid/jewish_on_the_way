import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchClassifierService } from './search-classifier.service';
import { SearchFeedback } from './search-feedback.entity';
import { ClassifierService } from './classifier.service';
import { SearchController } from './search.controller';
import { Destination } from '../destination.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SearchFeedback, Destination])],
  providers: [SearchClassifierService, ClassifierService],
  controllers: [SearchController],
  exports: [SearchClassifierService, ClassifierService],
})
export class AiModule {}
