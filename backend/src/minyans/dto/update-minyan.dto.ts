import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const PRAYER_TYPES = ['shacharit', 'mincha', 'maariv', 'musaf', 'other'];

export class UpdateMinyanDto {
  @IsOptional()
  @IsIn(PRAYER_TYPES)
  prayerType?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  locationText?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
