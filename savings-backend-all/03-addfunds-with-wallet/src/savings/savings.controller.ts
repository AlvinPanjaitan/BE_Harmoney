import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SavingsService } from './savings.service';
import { Savings } from './entities/savings.entity';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { AddFundsDto } from './dto/add-funds.dto';

@ApiTags('savings')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  // ─── POST /api/savings — create a new goal ────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new savings goal' })
  @ApiBody({ type: CreateSavingsDto })
  @ApiCreatedResponse({ description: 'Goal created.', type: Savings })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  @ApiForbiddenResponse({ description: 'Caller does not own the linked wallet.' })
  @ApiNotFoundResponse({ description: 'Linked wallet does not exist.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSavingsDto,
  ): Promise<Savings> {
    return this.savingsService.create(user.sub, dto);
  }

  // ─── GET /api/savings/:id — fetch a single goal ───────────────────────────
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a savings goal by id' })
  @ApiParam({ name: 'id', type: 'integer', example: 1 })
  @ApiOkResponse({ description: 'The savings goal.', type: Savings })
  @ApiNotFoundResponse({ description: 'No goal with the given id.' })
  @ApiForbiddenResponse({ description: 'Goal belongs to a different user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findOne(
    @Param('id', ParseIntPipe) savingId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<Savings> {
    return this.savingsService.findOne(savingId, user.sub);
  }

  // ─── POST /api/savings/:id/add-funds — required business method ───────────
  @Post(':id/add-funds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfer funds from a wallet into a savings goal',
    description:
      'Deducts `amount` from `fromWalletId` and adds it to the goal in a ' +
      'single SERIALIZABLE transaction. Caller must own both the goal and the ' +
      'source wallet.',
  })
  @ApiParam({ name: 'id', type: 'integer', example: 1 })
  @ApiBody({ type: AddFundsDto })
  @ApiOkResponse({
    description: 'Funds transferred successfully.',
    schema: { example: { message: 'Funds added successfully' } },
  })
  @ApiBadRequestResponse({
    description:
      'Validation failure, insufficient funds, or goal outside its active window.',
  })
  @ApiForbiddenResponse({
    description:
      'Caller does not own the savings goal or the source wallet.',
  })
  @ApiNotFoundResponse({
    description: 'Savings goal or source wallet not found.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async addFunds(
    @Param('id', ParseIntPipe) savingId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddFundsDto,
  ): Promise<{ message: string }> {
    await this.savingsService.addFunds(
      savingId,
      dto.amount,
      dto.fromWalletId,
      user.sub,
    );
    return { message: 'Funds added successfully' };
  }

  // ─── GET /api/savings/:id/progress — required business method ─────────────
  @Get(':id/progress')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a savings goal\'s progress as a decimal',
    description:
      'Returns `currentAmount / targetAmount` as a number in [0, 1+]. ' +
      'Returns 0 when targetAmount is 0.',
  })
  @ApiParam({ name: 'id', type: 'integer', example: 1 })
  @ApiOkResponse({
    description: 'Progress ratio (e.g. 0.75 → 75% complete).',
    schema: {
      example: {
        savingId: 1,
        currentAmount: 750,
        targetAmount: 1000,
        progress: 0.75,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No goal with the given id.' })
  @ApiForbiddenResponse({ description: 'Goal belongs to a different user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async progress(
    @Param('id', ParseIntPipe) savingId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    savingId: number;
    currentAmount: number;
    targetAmount: number;
    progress: number;
  }> {
    // findOne enforces ownership BEFORE we compute progress
    const saving = await this.savingsService.findOne(savingId, user.sub);
    const progress = await this.savingsService.calculateProgress(savingId);

    return {
      savingId: saving.savingId,
      currentAmount: Number(saving.currentAmount),
      targetAmount: Number(saving.targetAmount),
      progress,
    };
  }
}
