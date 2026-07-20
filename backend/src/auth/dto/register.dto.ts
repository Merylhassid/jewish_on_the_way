import { IsEmail, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { PASSWORD_PATTERN, PERSON_NAME_PATTERN } from '../password-policy';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  @MaxLength(128, {
    message: 'Password must be at most 128 characters long',
  })
  @Matches(PASSWORD_PATTERN, {
    message:
      'Password must be 8-128 characters and include at least one letter and one number',
  })
  password: string;

  @IsString()
  @Matches(PERSON_NAME_PATTERN, {
    message: 'First name can contain Hebrew or English letters, spaces, apostrophes, and hyphens',
  })
  firstName: string;

  @IsString()
  @Matches(PERSON_NAME_PATTERN, {
    message: 'Last name can contain Hebrew or English letters, spaces, apostrophes, and hyphens',
  })
  lastName: string;
}
