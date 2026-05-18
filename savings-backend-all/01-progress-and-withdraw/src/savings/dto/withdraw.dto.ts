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
 * POST /api/savings/:id/withdraw
 *
 * Validation rules
 * ────────────────
 * amount  – required; > 0; max 2 decimal places; capped at 1 billion
 * note    – optional string, max 500 chars
 * date    – optional ISO 8601 string; service defaults to Date.now() when absent
 *
 * The service enforces the additional business rule that `amount` must not
 * exceed the goal's current `savedAmount` (insufficient-funds check).
 * That check lives in the service — not here — because it requires a DB read.
 */
export class WithdrawDto {
  @ApiProperty({
    description:
      'Amount to withdraw. Must be greater than zero and must not exceed ' +
      'the current saved amount of the goal (validated in service).',
    example: 200,
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
    description: 'Optional reason or note for the withdrawal.',
    example: 'Emergency repair',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(500, { message: 'note must not exceed 500 characters' })
  note?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601 date-time of the withdrawal. Defaults to current date/time when omitted.',
    example: '2026-05-16T12:00:00Z',
  })
  @IsOptional()
  @IsDateString(
    { strict: false },
    {
      message:
        'date must be a valid ISO 8601 date-time string (e.g. 2026-05-16T12:00:00Z)',
    },
  )
  date?: string;
}
