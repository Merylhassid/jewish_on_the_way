import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,}$/, {
    message: 'Password must contain only English letters and numbers, and include at least one letter and one number',
  })
  password: string;

  @IsString()
  @Matches(/^[A-Za-z]+$/)
  firstName: string;

  @IsString()
  @Matches(/^[A-Za-z]+$/)
  lastName: string;
}
