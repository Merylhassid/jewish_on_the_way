import { IsEmail } from 'class-validator';

export class RequestAccountDeletionDto {
  @IsEmail()
  email: string;
}
