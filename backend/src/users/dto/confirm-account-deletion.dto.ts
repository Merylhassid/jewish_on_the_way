import { IsString, Matches } from 'class-validator';

export class ConfirmAccountDeletionDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Invalid deletion token' })
  token: string;
}
