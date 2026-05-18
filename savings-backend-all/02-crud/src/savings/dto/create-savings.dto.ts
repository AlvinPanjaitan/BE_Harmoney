import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * POST /api/savings — body validation.
 *
 * Notes
 * ─────
 * • `currentSaved` and `status` are intentionally not on this DTO. They are
 *   set by the service to their defaults (0 and ACTIVE) — never accepted
 *   from a client on creation.
 * • The global ValidationPipe is configured with `forbidNonWhitelisted: true`,
 *   so a client trying to seed `currentSaved` via POST gets a 400.
 */
export class CreateSavingsDto {
  @ApiProperty({
    description: 'Human-readable name of the goal.',
    example: 'Car Fund',
    maxLength: 100,
  })
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(100, { message: 'name must be 100 characters or fewer' })
  name: string;

  @ApiProperty({
    description: 'Amount the user wants to save (positive, up to 2 decimals).',
    example: 5000,
    minimum: 0.01,
    maximum: 1_000_000_000,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'targetAmount must be a number with at most 2 decimal places' },
  )
  @IsPositive({ message: 'targetAmount must be greater than 0' })
  @Max(1_000_000_000, { message: 'targetAmount must not exceed 1,000,000,000' })
  targetAmount: number;

  @ApiPropertyOptional({
    description: 'Optional ISO 8601 deadline by which the goal should be reached.',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString(
    { strict: false },
    { message: 'deadline must be a valid ISO 8601 date string' },
  )
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Optional free-text note describing the goal.',
    example: 'New car for the family',
  })
  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(2000, { message: 'note must be 2000 characters or fewer' })
  note?: string;
}
