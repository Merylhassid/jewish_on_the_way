import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateOfferDto {
  @IsInt()
  destinationId: number;

  @IsOptional()
  @IsIn(['stay', 'meals', 'both'])
  hostingType?: 'stay' | 'meals' | 'both';

  @IsDateString()
  availableFrom: string;

  @IsDateString()
  availableTo: string;

  @IsInt()
  @Min(1)
  maxGuests: number;

  @IsBoolean()
  allowsChildren: boolean;

  @IsBoolean()
  allowsShabbat: boolean;

  @IsOptional()
  @IsString()
  kashrutLevel?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
