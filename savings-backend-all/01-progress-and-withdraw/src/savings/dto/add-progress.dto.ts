import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * POST /api/savings/:id/add
 *
 * Validation rules
 * ────────────────
 * amount  – required number, must be > 0, capped at 1 billion per contribution
 * note    – optional string, max 500 chars
 * date    – optional ISO 8601 string; when omitted the service uses Date.now()
 */
export class AddProgressDto {
  @ApiProperty({
    description: 'Contribution amount — must be greater than zero.',
    example: 500,
    minimum: 0.01,
    maximum: 1_000_000_000,
  })
  @IsNotEmpty({ message: 'amount is required' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places' },
  )
  @Min(0.01, { message: 'amount must be greater than 0' })
  @Max(1_000_000_000, { message: 'amount must not exceed 1,000,000,000' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Optional note describing the contribution.',
    example: 'Monthly deposit',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(500, { message: 'note must not exceed 500 characters' })
  note?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601 date-time for the contribution. Defaults to current date/time when omitted.',
    example: '2026-05-16T10:00:00Z',
  })
  @IsOptional()
  @IsDateString(
    { strict: false },
    { message: 'date must be a valid ISO 8601 date-time string (e.g. 2026-05-16T10:00:00Z)' },
  )
  date?: string;
}
