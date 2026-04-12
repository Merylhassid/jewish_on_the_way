import { Global, Module } from '@nestjs/common';
import { SearchClassifierService } from './search-classifier.service';

@Global()
@Module({
  providers: [SearchClassifierService],
  exports: [SearchClassifierService],
})
export class AiModule {}
