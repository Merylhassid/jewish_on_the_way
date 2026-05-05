import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, {
    message: 'New password must be at least 8 characters long',
  })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,}$/, {
    message: 'Password must contain only English letters and numbers, and include at least one letter and one number',
  })
  newPassword: string;
}
