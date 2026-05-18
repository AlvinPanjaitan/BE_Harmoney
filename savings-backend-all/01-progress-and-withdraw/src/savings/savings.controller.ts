import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SavingsService } from './savings.service';
import { AddProgressDto } from './dto/add-progress.dto';
import { AddProgressResponseDto } from './dto/add-progress-response.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { WithdrawResponseDto } from './dto/withdraw-response.dto';

@ApiTags('Savings')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/savings/:id/add
  // ─────────────────────────────────────────────────────────────────────────
  @Post(':id/add')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a contribution to a savings goal',
    description:
      'Records a new contribution toward the specified savings goal, ' +
      'updates the goal's running total, and returns the progress record. ' +
      'Only the goal owner may call this endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the savings goal to contribute toward.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @ApiBody({ type: AddProgressDto })
  @ApiCreatedResponse({
    description: 'Contribution recorded. Returns the new progress entry.',
    type: AddProgressResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT Bearer token.',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2026-05-16T10:00:00.000Z',
        path: '/api/savings/a1b2c3d4-.../add',
        method: 'POST',
        message: 'Access denied — valid JWT Bearer token required',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not the owner of this goal.',
    schema: {
      example: {
        statusCode: 403,
        timestamp: '2026-05-16T10:00:00.000Z',
        path: '/api/savings/a1b2c3d4-.../add',
        method: 'POST',
        message: 'You do not have permission to modify this savings goal.',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Savings goal with the given ID does not exist.',
    schema: {
      example: {
        statusCode: 404,
        timestamp: '2026-05-16T10:00:00.000Z',
        path: '/api/savings/a1b2c3d4-.../add',
        method: 'POST',
        message: "Savings goal 'a1b2c3d4-...' not found.",
      },
    },
  })
  async addProgress(
    @Param('id', new ParseUUIDPipe({ version: '4' })) goalId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddProgressDto,
  ): Promise<AddProgressResponseDto> {
    return this.savingsService.addProgress(goalId, user.sub, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/savings/:id/withdraw
  // ─────────────────────────────────────────────────────────────────────────
  @Post(':id/withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Withdraw an amount from a savings goal',
    description:
      'Decrements the goal's saved amount by the requested withdrawal, ' +
      'logs the transaction, and returns the withdrawal record. ' +
      'Fails with 400 if the withdrawal amount exceeds the current balance. ' +
      'Only the goal owner may call this endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the savings goal to withdraw from.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @ApiBody({ type: WithdrawDto })
  @ApiCreatedResponse({
    description: 'Withdrawal recorded. Returns the new withdrawal entry.',
    type: WithdrawResponseDto,
    schema: {
      example: {
        id: 'f7e6d5c4-b3a2-4190-8fed-cba987654321',
        savingsId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: 'WITHDRAWAL',
        amount: 200,
        date: '2026-05-16T12:00:00.000Z',
        note: 'Emergency repair',
        newTotalSaved: 800,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Validation failure (invalid body) or insufficient funds.',
    schema: {
      examples: {
        insufficientFunds: {
          summary: 'Withdrawal exceeds balance',
          value: {
            statusCode: 400,
            timestamp: '2026-05-16T12:00:00.000Z',
            path: '/api/savings/a1b2c3d4-.../withdraw',
            method: 'POST',
            message:
              'Insufficient funds: cannot withdraw 500 from a balance of 200.',
          },
        },
        validationError: {
          summary: 'Invalid request body',
          value: {
            statusCode: 400,
            timestamp: '2026-05-16T12:00:00.000Z',
            path: '/api/savings/a1b2c3d4-.../withdraw',
            method: 'POST',
            message: ['amount must be greater than 0'],
            error: 'Bad Request',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT Bearer token.',
    schema: {
      example: {
        statusCode: 401,
        timestamp: '2026-05-16T12:00:00.000Z',
        path: '/api/savings/a1b2c3d4-.../withdraw',
        method: 'POST',
        message: 'Access denied — valid JWT Bearer token required',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not the owner of this goal.',
    schema: {
      example: {
        statusCode: 403,
        timestamp: '2026-05-16T12:00:00.000Z',
        path: '/api/savings/a1b2c3d4-.../withdraw',
        method: 'POST',
        message: 'You do not have permission to modify this savings goal.',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Savings goal with the given ID does not exist.',
    schema: {
      example: {
        statusCode: 404,
        timestamp: '2026-05-16T12:00:00.000Z',
        path: '/api/savings/a1b2c3d4-.../withdraw',
        method: 'POST',
        message: "Savings goal 'a1b2c3d4-...' not found.",
      },
    },
  })
  async withdraw(
    @Param('id', new ParseUUIDPipe({ version: '4' })) goalId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: WithdrawDto,
  ): Promise<WithdrawResponseDto> {
    return this.savingsService.withdraw(goalId, user.sub, dto);
  }
}
