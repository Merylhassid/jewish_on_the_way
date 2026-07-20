import { IsIn } from 'class-validator';
import type { UserReportStatus } from '../user-report.entity';

export class ResolveReportDto {
  @IsIn(['open', 'resolved'])
  status: UserReportStatus;
}
