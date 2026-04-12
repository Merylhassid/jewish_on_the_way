import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z\u0020]+$/, {
    message: 'firstName can contain only English letters and spaces',
  })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z\u0020]+$/, {
    message: 'lastName can contain only English letters and spaces',
  })
  lastName?: string;

  // req 2.1.1 — kashrut preference
  @IsOptional()
  @IsIn(['none', 'rabbinate', 'mehadrin', 'badatz'])
  kashrutLevel?: string;
}
