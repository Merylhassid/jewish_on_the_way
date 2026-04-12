import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRequestDto {
  @IsInt()
  offerId: number;

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
