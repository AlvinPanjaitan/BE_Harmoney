import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavingsGoal, SavingsStatus } from './entities/savings-goal.entity';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';
import { FindAllSavingsQueryDto } from './dto/find-all-savings-query.dto';

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(
    @InjectRepository(SavingsGoal)
    private readonly goalRepo: Repository<SavingsGoal>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List goals for the authenticated user, optionally filtered + sorted.
   * Ownership is enforced by always pinning `userId` in the WHERE clause —
   * a user can never see another user's goals, even if they could guess an id.
   */
  async findAll(
    userId: string,
    filters: FindAllSavingsQueryDto,
  ): Promise<SavingsGoal[]> {
    const qb = this.goalRepo
      .createQueryBuilder('goal')
      .where('goal.userId = :userId', { userId });

    // ── status filter ───────────────────────────────────────────────────
    if (filters.status && filters.status !== 'all') {
      qb.andWhere('goal.status = :status', { status: filters.status });
    }

    // ── sort ────────────────────────────────────────────────────────────
    // deadline ASC NULLS LAST  → closest deadlines first, undated last
    // createdAt DESC           → newest first (default)
    if (filters.sort === 'deadline') {
      qb.orderBy('goal.deadline', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('goal.createdAt', 'DESC');
    }

    return qb.getMany();
  }

  /**
   * Fetch a single goal by id. Throws:
   *  • 404 if no row matches
   *  • 403 if the row exists but belongs to a different user
   *
   * The two-step check (find then compare userId) gives a clearer error
   * than a single `findOne({ id, userId })` which would always return 404
   * even on access violations — making it harder to debug client mistakes.
   */
  async findOne(id: string, userId: string): Promise<SavingsGoal> {
    const goal = await this.goalRepo.findOne({ where: { id } });
    if (!goal) {
      throw new NotFoundException(`Savings goal '${id}' not found.`);
    }
    if (goal.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this savings goal.',
      );
    }
    return goal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new goal owned by `userId`.
   * The service controls `userId`, `currentSaved`, and `status` — clients
   * cannot inject these values from the body.
   */
  async create(userId: string, dto: CreateSavingsDto): Promise<SavingsGoal> {
    try {
      const goal = this.goalRepo.create({
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        note: dto.note ?? null,
        currentSaved: 0,                    // service-controlled default
        status: SavingsStatus.ACTIVE,       // service-controlled default
      });

      const saved = await this.goalRepo.save(goal);
      this.logger.log(`Goal '${saved.id}' created for user ${userId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Create goal failed for user ${userId}`, error?.stack);
      throw new InternalServerErrorException('Could not create savings goal.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Partial update. Re-uses findOne() so the 404/403 logic is in one place.
   *
   * `currentSaved` is intentionally not assignable here — that field is owned
   * by the contribution / withdrawal endpoints. The DTO already forbids it via
   * forbidNonWhitelisted, but as belt-and-braces we never copy it across.
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateSavingsDto,
  ): Promise<SavingsGoal> {
    const goal = await this.findOne(id, userId); // 404 / 403 handled here

    if (dto.name !== undefined)         goal.name = dto.name;
    if (dto.targetAmount !== undefined) goal.targetAmount = dto.targetAmount;
    if (dto.deadline !== undefined)     goal.deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (dto.note !== undefined)         goal.note = dto.note;
    if (dto.status !== undefined)       goal.status = dto.status;

    try {
      const saved = await this.goalRepo.save(goal);
      this.logger.log(`Goal '${id}' updated by user ${userId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Update goal failed for '${id}'`, error?.stack);
      throw new InternalServerErrorException('Could not update savings goal.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Delete after ownership check. Cascades to related contribution /
   * withdrawal rows via the FKs declared on those entities.
   */
  async delete(id: string, userId: string): Promise<{ message: string }> {
    const goal = await this.findOne(id, userId); // 404 / 403

    try {
      await this.goalRepo.remove(goal);
      this.logger.log(`Goal '${id}' deleted by user ${userId}`);
      return { message: 'Savings goal deleted successfully' };
    } catch (error) {
      this.logger.error(`Delete goal failed for '${id}'`, error?.stack);
      throw new InternalServerErrorException('Could not delete savings goal.');
    }
  }
}
