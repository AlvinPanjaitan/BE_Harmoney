import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SavingsService } from './savings.service';
import { SavingsGoal, SavingsStatus } from './entities/savings-goal.entity';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';
import { FindAllSavingsQueryDto } from './dto/find-all-savings-query.dto';

// Single source of truth for Swagger example payloads
const GOAL_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  userId: 'u1234567-89ab-cdef-0123-456789abcdef',
  name: 'Car Fund',
  targetAmount: 5000,
  currentSaved: 1500,
  deadline: '2026-12-31T00:00:00.000Z',
  note: 'New car for the family',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

@ApiTags('savings')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/savings
  // ─────────────────────────────────────────────────────────────────────────
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List savings goals for the authenticated user',
    description:
      'Returns goals owned by the caller, optionally filtered by status ' +
      'and sorted by deadline or creation date.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [...Object.values(SavingsStatus), 'all'],
    description: 'Filter by status. Default: all.',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['deadline', 'createdAt'],
    description: 'Sort field. Default: createdAt (descending).',
  })
  @ApiOkResponse({
    description: 'List of savings goals owned by the user.',
    schema: { type: 'array', items: { example: GOAL_EXAMPLE } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: FindAllSavingsQueryDto,
  ): Promise<SavingsGoal[]> {
    return this.savingsService.findAll(user.sub, query);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/savings/:id
  // ─────────────────────────────────────────────────────────────────────────
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a single savings goal by id',
    description:
      'Returns the specified goal. 404 if it does not exist, 403 if it ' +
      'exists but belongs to another user.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: GOAL_EXAMPLE.id })
  @ApiOkResponse({ description: 'The savings goal.', schema: { example: GOAL_EXAMPLE } })
  @ApiNotFoundResponse({ description: 'No goal with the given id.' })
  @ApiForbiddenResponse({ description: 'Goal belongs to a different user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SavingsGoal> {
    return this.savingsService.findOne(id, user.sub);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/savings
  // ─────────────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new savings goal',
    description:
      'Creates a goal owned by the caller. `currentSaved` defaults to 0 ' +
      'and `status` defaults to "active" — neither can be set on creation.',
  })
  @ApiBody({ type: CreateSavingsDto })
  @ApiCreatedResponse({
    description: 'Goal created.',
    schema: { example: { ...GOAL_EXAMPLE, currentSaved: 0, status: 'active' } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSavingsDto,
  ): Promise<SavingsGoal> {
    return this.savingsService.create(user.sub, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /api/savings/:id
  // ─────────────────────────────────────────────────────────────────────────
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Partially update a savings goal',
    description:
      'Only the caller may update their own goal. Omitted fields are ' +
      'preserved. `currentSaved` is not updatable here — use the ' +
      'contribution / withdrawal endpoints instead.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: GOAL_EXAMPLE.id })
  @ApiBody({ type: UpdateSavingsDto })
  @ApiOkResponse({ description: 'Goal updated.', schema: { example: GOAL_EXAMPLE } })
  @ApiNotFoundResponse({ description: 'No goal with the given id.' })
  @ApiForbiddenResponse({ description: 'Goal belongs to a different user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSavingsDto,
  ): Promise<SavingsGoal> {
    return this.savingsService.update(id, user.sub, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/savings/:id
  // ─────────────────────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a savings goal',
    description: 'Removes the goal and cascades to any contribution / withdrawal records.',
  })
  @ApiParam({ name: 'id', format: 'uuid', example: GOAL_EXAMPLE.id })
  @ApiOkResponse({
    description: 'Goal deleted.',
    schema: { example: { message: 'Savings goal deleted successfully' } },
  })
  @ApiNotFoundResponse({ description: 'No goal with the given id.' })
  @ApiForbiddenResponse({ description: 'Goal belongs to a different user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    return this.savingsService.delete(id, user.sub);
  }
}
