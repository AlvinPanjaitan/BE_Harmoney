import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SavingsStatus } from '../entities/savings-goal.entity';

/**
 * Query-string filter shape for GET /api/savings.
 *
 * Both values are optional. The service defaults:
 *   status → 'all'        (no filter)
 *   sort   → 'createdAt'  (newest first)
 */
export type StatusFilter = SavingsStatus | 'all';
export type SortField = 'deadline' | 'createdAt';

const STATUS_FILTER_VALUES: StatusFilter[] = [
  ...Object.values(SavingsStatus),
  'all',
];
const SORT_VALUES: SortField[] = ['deadline', 'createdAt'];

export class FindAllSavingsQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter goals by status. "all" (default) returns every goal owned by the user.',
    enum: STATUS_FILTER_VALUES,
    example: 'active',
  })
  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES, {
    message: `status must be one of: ${STATUS_FILTER_VALUES.join(', ')}`,
  })
  status?: StatusFilter;

  @ApiPropertyOptional({
    description:
      'Field to sort by. "deadline" → ascending (nearest first, nulls last). ' +
      '"createdAt" → descending (newest first). Default: createdAt.',
    enum: SORT_VALUES,
    example: 'deadline',
  })
  @IsOptional()
  @IsIn(SORT_VALUES, {
    message: `sort must be one of: ${SORT_VALUES.join(', ')}`,
  })
  sort?: SortField;
}
