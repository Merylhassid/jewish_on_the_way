import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReportStatus {
  PENDING  = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
}

export class ResolveReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
