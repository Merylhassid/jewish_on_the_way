import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @Matches(/^[A-Za-z]+$/)
  firstName: string;

  @IsString()
  @Matches(/^[A-Za-z]+$/)
  lastName: string;
}
