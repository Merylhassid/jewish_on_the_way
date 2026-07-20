import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRequestDto {
  @IsInt()
  offerId: number;

  @IsIn(['stay', 'meals'])
  hostingType: 'stay' | 'meals';

  @IsDateString()
  arrivalDate: string;

  @IsDateString()
  departureDate: string;

  @IsInt()
  @Min(1)
  guestsCount: number;

  @IsBoolean()
  withChildren: boolean;

  @IsBoolean()
  forShabbat: boolean;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}
