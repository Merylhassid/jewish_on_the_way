import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isFutureOrToday', async: false })
export class IsFutureOrTodayConstraint implements ValidatorConstraintInterface {
  validate(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }
  defaultMessage(_args: ValidationArguments) {
    return 'Date must be today or in the future';
  }
}

export class CreateMinyanDto {
  @IsIn(['shacharit', 'mincha', 'maariv', 'musaf', 'other'])
  prayerType: string;

  @IsDateString()
  @Validate(IsFutureOrTodayConstraint)
  date: string; // "YYYY-MM-DD"

  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be HH:MM' })
  time: string;

  @IsString()
  @Length(3, 200)
  locationText: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsInt()
  destinationId: number;
}
