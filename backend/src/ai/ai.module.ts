import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchClassifierService } from './search-classifier.service';
import { SearchFeedback } from './search-feedback.entity';
import { ClassifierService } from './classifier.service';
import { SearchController } from './search.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SearchFeedback])],
  providers: [SearchClassifierService, ClassifierService],
  controllers: [SearchController],
  exports: [SearchClassifierService, ClassifierService],
})
export class AiModule {}
