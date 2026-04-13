import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchClassifierService } from './search-classifier.service';
import { SearchFeedback } from './search-feedback.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SearchFeedback])],
  providers: [SearchClassifierService],
  exports: [SearchClassifierService],
})
export class AiModule {}
