import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsPositive,
  Max,
} from 'class-validator';

/**
 * POST /api/savings/:id/add-funds — request body.
 *
 * `amount` is the transfer amount, deducted from `fromWalletId` and added to
 * the savings goal's `currentAmount`. Both operations run inside a single
 * SERIALIZABLE transaction in SavingsService.addFunds().
 */
export class AddFundsDto {
  @ApiProperty({
    description: 'Amount to transfer (must be > 0).',
    example: 250,
    minimum: 0.01,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'amount must be a finite number' },
  )
  @IsPositive({ message: 'amount must be greater than 0' })
  @Max(1_000_000_000, { message: 'amount must not exceed 1,000,000,000' })
  amount: number;

  @ApiProperty({
    description: 'Integer id of the source wallet to debit.',
    example: 42,
  })
  @IsInt({ message: 'fromWalletId must be an integer' })
  @IsPositive({ message: 'fromWalletId must be positive' })
  fromWalletId: number;
}
