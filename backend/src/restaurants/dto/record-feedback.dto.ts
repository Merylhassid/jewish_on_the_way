import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordFeedbackDto {
  @IsString()
  @MaxLength(500)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  detectedType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  detectedKashrut?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detectedKeyword?: string;

  @IsString()
  @MaxLength(200)
  clickedRestaurantName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clickedRestaurantType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clickedRestaurantKashrut?: string;
}
