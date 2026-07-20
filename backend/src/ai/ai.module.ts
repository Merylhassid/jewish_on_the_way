import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchClassifierService } from './search-classifier.service';
import { SearchFeedback } from './search-feedback.entity';
import { ClassifierService } from './classifier.service';
import { DenominationClassifierService } from './denomination-classifier.service';
import { SearchController } from './search.controller';
import { DestinationIndexService } from './destination-index.service';
import { Destination } from '../destination.entity';
import { QueryParserService } from './query-parser.service';
import { SearchFeedbackRetentionService } from './search-feedback-retention.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SearchFeedback, Destination])],
  providers: [
    SearchClassifierService,
    ClassifierService,
    DenominationClassifierService,
    DestinationIndexService,
    QueryParserService,
    SearchFeedbackRetentionService,
  ],
  controllers: [SearchController],
  exports: [
    SearchClassifierService,
    ClassifierService,
    DenominationClassifierService,
    DestinationIndexService,
    QueryParserService,
  ],
})
export class AiModule {}
