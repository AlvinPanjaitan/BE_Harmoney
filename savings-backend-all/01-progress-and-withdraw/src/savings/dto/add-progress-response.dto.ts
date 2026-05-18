import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape returned by POST /api/savings/:id/add (HTTP 201).
 *
 * Used as the Swagger @ApiResponse type so the docs are accurate,
 * and as a plain interface for the service return value so TypeScript
 * catches any field mismatches at compile time.
 */
export class AddProgressResponseDto {
  @ApiProperty({
    description: 'UUID of the newly created progress record.',
    example: 'd3f1a2b4-8e9c-4a1b-b2c3-1234567890ab',
  })
  id: string;

  @ApiProperty({
    description: 'UUID of the savings goal this contribution belongs to.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  savingsId: string;

  @ApiProperty({
    description: 'Contribution amount recorded.',
    example: 500,
  })
  amount: number;

  @ApiProperty({
    description: 'Date/time the contribution was recorded (ISO 8601).',
    example: '2026-05-16T10:00:00.000Z',
  })
  date: string;

  @ApiProperty({
    description: 'Optional note attached to the contribution.',
    example: 'Monthly deposit',
    nullable: true,
  })
  note: string | null;

  @ApiProperty({
    description:
      "Goal's cumulative saved amount after this contribution was applied.",
    example: 1500,
  })
  newTotalSaved: number;
}
