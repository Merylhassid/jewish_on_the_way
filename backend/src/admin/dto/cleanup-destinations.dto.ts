import { IsArray, IsInt, ArrayNotEmpty, IsBoolean } from 'class-validator';

export class CleanupDestinationsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  destinationIds: number[];

  @IsBoolean()
  confirm: boolean;
}
