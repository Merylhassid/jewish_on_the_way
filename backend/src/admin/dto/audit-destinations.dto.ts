import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class AuditDestinationsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  destinationIds: number[];
}
