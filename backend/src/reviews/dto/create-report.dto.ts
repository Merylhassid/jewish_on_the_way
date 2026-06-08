import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReportType {
  NOT_KOSHER = 'not_kosher',
  CLOSED     = 'closed',
  MOVED      = 'moved',
  WRONG_INFO = 'wrong_info',
  OTHER      = 'other',
}

export class CreateReportDto {
  @IsEnum(ReportType)
  reportType: ReportType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
