import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateSavingsDto } from './create-savings.dto';
import { SavingsStatus } from '../entities/savings-goal.entity';

/**
 * PATCH /api/savings/:id — body validation.
 *
 * Extends every field from CreateSavingsDto as optional (via PartialType)
 * and adds `status` so the user can mark a goal as completed.
 *
 * Note on PartialType: the spec requires `@nestjs/mapped-types`. That package
 * preserves class-validator decorators but drops Swagger metadata, so each
 * field that should appear in Swagger docs needs its own @ApiPropertyOptional —
 * which is exactly what CreateSavingsDto already declares with @ApiProperty,
 * and what we add explicitly below for `status`.
 */
export class UpdateSavingsDto extends PartialType(CreateSavingsDto) {
  @ApiPropertyOptional({
    description: 'Lifecycle status of the goal.',
    enum: SavingsStatus,
    example: SavingsStatus.COMPLETED,
  })
  @IsOptional()
  @IsIn(Object.values(SavingsStatus), {
    message: `status must be one of: ${Object.values(SavingsStatus).join(', ')}`,
  })
  status?: SavingsStatus;
}
