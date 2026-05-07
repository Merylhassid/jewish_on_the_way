import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Synagogue } from '../synagogue.entity';
import { Destination } from '../destination.entity';
import { SynagoguesController } from './synagogues.controller';
import { SynagoguesService } from './synagogues.service';

@Module({
  imports: [TypeOrmModule.forFeature([Synagogue, Destination])],
  controllers: [SynagoguesController],
  providers: [SynagoguesService],
})
export class SynagoguesModule {}
