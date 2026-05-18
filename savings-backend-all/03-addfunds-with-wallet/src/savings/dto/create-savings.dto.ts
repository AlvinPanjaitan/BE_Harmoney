import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * POST /api/savings — request body.
 *
 * `currentAmount` is not on this DTO. Newly created goals always start at 0;
 * the service sets it explicitly. The global ValidationPipe's
 * `forbidNonWhitelisted: true` rejects any client attempt to set it.
 */
export class CreateSavingsDto {
  @ApiProperty({
    description: 'Integer id of the wallet that owns this savings goal.',
    example: 42,
  })
  @IsInt({ message: 'walletId must be an integer' })
  @IsPositive({ message: 'walletId must be positive' })
  walletId: number;

  @ApiProperty({
    description: 'Human-readable name of the goal.',
    example: 'Vacation Fund',
    maxLength: 120,
  })
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(120, { message: 'name must be 120 characters or fewer' })
  name: string;

  @ApiProperty({
    description: 'Target amount the user wants to save.',
    example: 10_000,
    minimum: 0.01,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'targetAmount must be a finite number' },
  )
  @IsPositive({ message: 'targetAmount must be greater than 0' })
  @Max(1_000_000_000, { message: 'targetAmount must not exceed 1,000,000,000' })
  targetAmount: number;

  @ApiProperty({
    description: 'ISO 8601 date when the savings period begins.',
    example: '2026-01-01T00:00:00Z',
  })
  @IsDateString({ strict: false }, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate: string;

  @ApiProperty({
    description: 'ISO 8601 date when the savings period ends.',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString({ strict: false }, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate: string;
}
