import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserReport } from './user-report.entity';
import { User } from '../users/user.entity';
import { HostingRequest } from '../hosting/entities/hosting-request.entity';
import { HostingOffer } from '../hosting/entities/hosting-offer.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserReport, User, HostingRequest, HostingOffer])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
