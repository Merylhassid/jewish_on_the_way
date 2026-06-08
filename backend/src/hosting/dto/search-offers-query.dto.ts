import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsInt, IsOptional, Max, Min,
} from 'class-validator';

export class SearchOffersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationId: number;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestsCount?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  forShabbat?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withChildren?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
