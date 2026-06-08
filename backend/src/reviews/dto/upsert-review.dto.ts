import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
