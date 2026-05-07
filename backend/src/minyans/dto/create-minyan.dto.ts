import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateMinyanDto {
  @IsIn(['shacharit', 'mincha', 'maariv', 'musaf', 'other'])
  prayerType: string;

  @IsDateString()
  date: string; // "YYYY-MM-DD"

  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be HH:MM' })
  time: string;

  @IsString()
  @Length(3, 200)
  locationText: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsInt()
  destinationId: number;
}
