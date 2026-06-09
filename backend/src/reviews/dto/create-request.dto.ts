import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EntityType } from '../../common/enums/entity-type.enum';

export class CreateRequestDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsOptional()
  @IsInt()
  @Min(1)
  destinationId?: number;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  kashrutLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  restaurantType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nusach?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  denomination?: string;
}
