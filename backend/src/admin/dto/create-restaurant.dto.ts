import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['meat', 'dairy', 'pareve'])
  restaurantType: string;

  @IsIn(['rabbinate', 'mehadrin', 'badatz'])
  kashrutLevel: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  destinationId: number;
}
