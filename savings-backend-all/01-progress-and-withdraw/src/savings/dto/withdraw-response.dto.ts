import { ApiProperty } from '@nestjs/swagger';

/**
 * Response returned by POST /api/savings/:id/withdraw (HTTP 201).
 *
 * The `type` field is always "WITHDRAWAL", allowing clients and
 * unified ledger queries to discriminate this from a contribution.
 */
export class WithdrawResponseDto {
  @ApiProperty({
    description: 'UUID of the newly created withdrawal record.',
    example: 'f7e6d5c4-b3a2-4190-8fed-cba987654321',
  })
  id: string;

  @ApiProperty({
    description: 'UUID of the savings goal this withdrawal belongs to.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  savingsId: string;

  @ApiProperty({
    description: 'Transaction type — always "WITHDRAWAL" for this endpoint.',
    example: 'WITHDRAWAL',
    enum: ['WITHDRAWAL'],
  })
  type: 'WITHDRAWAL';

  @ApiProperty({
    description: 'The amount that was withdrawn (positive number).',
    example: 200,
  })
  amount: number;

  @ApiProperty({
    description: 'Date/time the withdrawal was recorded (ISO 8601).',
    example: '2026-05-16T12:00:00.000Z',
  })
  date: string;

  @ApiProperty({
    description: 'Optional note describing the reason for the withdrawal.',
    example: 'Emergency repair',
    nullable: true,
  })
  note: string | null;

  @ApiProperty({
    description:
      "Goal's cumulative saved amount after this withdrawal was applied.",
    example: 800,
  })
  newTotalSaved: number;
}
