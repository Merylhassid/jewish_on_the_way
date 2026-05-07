import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Minyan } from '../minyan.entity';
import { MinyanRegistration } from '../minyan-registration.entity';
import { Destination } from '../destination.entity';
import { User } from '../users/user.entity';
import { MinyansController } from './minyans.controller';
import { MinyansService } from './minyans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Minyan, MinyanRegistration, Destination, User]),
  ],
  controllers: [MinyansController],
  providers: [MinyansService],
})
export class MinyansModule {}
