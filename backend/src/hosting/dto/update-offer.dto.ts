import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateOfferDto {
  @IsOptional()
  @IsIn(['stay', 'meals', 'both'])
  hostingType?: 'stay' | 'meals' | 'both';

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  availableTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxGuests?: number;

  @IsOptional()
  @IsBoolean()
  allowsChildren?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsShabbat?: boolean;

  @IsOptional()
  @IsString()
  kashrutLevel?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
