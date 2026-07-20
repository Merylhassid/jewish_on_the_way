import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UserReportContext } from '../user-report.entity';

export class CreateReportDto {
  @IsIn(['hosting_chat', 'hosting_offer'])
  context: UserReportContext;

  @IsInt()
  entityId: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
