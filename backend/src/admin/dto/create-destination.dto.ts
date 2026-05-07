import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Length,
  IsOptional,
} from 'class-validator';

export class CreateDestinationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}
