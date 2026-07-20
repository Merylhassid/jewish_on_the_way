import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateNeedDto {
  @IsInt() @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  destinationId: number;

  @IsOptional()
  @IsIn(['stay', 'meals'])
  hostingType?: 'stay' | 'meals';

  @IsDateString()
  arrivalDate: string;

  @IsDateString()
  departureDate: string;

  @IsInt() @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  guestsCount: number;

  @IsOptional() @IsBoolean()
  withChildren?: boolean;

  @IsOptional() @IsBoolean()
  forShabbat?: boolean;

  @IsOptional() @IsString()
  notes?: string;
}
