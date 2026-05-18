import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsProgress } from './entities/savings-progress.entity';
import { SavingsWithdrawal } from './entities/savings-withdrawal.entity';
import { AddProgressDto } from './dto/add-progress.dto';
import { AddProgressResponseDto } from './dto/add-progress-response.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { WithdrawResponseDto } from './dto/withdraw-response.dto';

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(
    @InjectRepository(SavingsGoal)
    private readonly goalRepo: Repository<SavingsGoal>,

    @InjectRepository(SavingsProgress)
    private readonly progressRepo: Repository<SavingsProgress>,

    @InjectRepository(SavingsWithdrawal)
    private readonly withdrawalRepo: Repository<SavingsWithdrawal>,

    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Records a contribution toward a savings goal.
   *
   * Flow
   * ────
   * 1. Load the goal — 404 if it doesn't exist.
   * 2. Ownership check — 403 if the JWT user is not the goal owner.
   * 3. Open a serialisable transaction:
   *    a. Lock the goal row with SELECT … FOR UPDATE to prevent concurrent
   *       double-credits on the same goal.
   *    b. Increment savedAmount.
   *    c. Flip isCompleted when the target is reached.
   *    d. Insert SavingsProgress row with a snapshot of the new total.
   * 4. Return the progress record + newTotalSaved.
   */
  async addProgress(
    goalId: string,
    userId: string,
    dto: AddProgressDto,
  ): Promise<AddProgressResponseDto> {
    // ── 1. Existence check (outside transaction — fast path) ────────────
    const exists = await this.goalRepo.findOne({ where: { id: goalId } });
    if (!exists) {
      throw new NotFoundException(`Savings goal '${goalId}' not found.`);
    }

    // ── 2. Ownership check ───────────────────────────────────────────────
    if (exists.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this savings goal.',
      );
    }

    // ── 3. Transaction ───────────────────────────────────────────────────
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // 3a. Re-fetch with a row-level lock so concurrent requests are
      //     serialised rather than each reading the same stale total.
      const goal = await queryRunner.manager
        .getRepository(SavingsGoal)
        .createQueryBuilder('goal')
        .where('goal.id = :id', { id: goalId })
        .setLock('pessimistic_write')  // SELECT … FOR UPDATE
        .getOne();

      // Shouldn't happen after the fast-path check above, but guard anyway.
      if (!goal) {
        throw new NotFoundException(`Savings goal '${goalId}' not found.`);
      }

      // 3b. Increment — cast to Number because TypeORM returns numeric columns
      //     as strings from PostgreSQL drivers.
      const prevTotal = Number(goal.savedAmount);
      const contribution = Number(dto.amount);
      const newTotal = parseFloat((prevTotal + contribution).toFixed(2));

      goal.savedAmount = newTotal;

      // 3c. Auto-complete when target is reached
      if (newTotal >= Number(goal.targetAmount) && !goal.isCompleted) {
        goal.isCompleted = true;
        this.logger.log(
          `Goal '${goalId}' completed — target ${goal.targetAmount} reached.`,
        );
      }

      await queryRunner.manager.save(SavingsGoal, goal);

      // 3d. Create the immutable progress record
      const contributionDate = dto.date ? new Date(dto.date) : new Date();

      const progress = queryRunner.manager.create(SavingsProgress, {
        savingsId: goalId,
        amount: contribution,
        date: contributionDate,
        note: dto.note ?? null,
        savedAmountSnapshot: newTotal,
      });

      const saved = await queryRunner.manager.save(SavingsProgress, progress);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Progress added: goal=${goalId} amount=${contribution} newTotal=${newTotal}`,
      );

      // ── 4. Build response ─────────────────────────────────────────────
      return {
        id: saved.id,
        savingsId: saved.savingsId,
        amount: Number(saved.amount),
        date: saved.date.toISOString(),
        note: saved.note,
        newTotalSaved: newTotal,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Re-throw domain exceptions unchanged
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to add progress for goal '${goalId}'`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Could not record contribution. The operation was rolled back.',
      );
    } finally {
      // Always release — even when an exception is thrown
      await queryRunner.release();
    }
  }

  // ── Helpers exposed for tests / other services ─────────────────────────

  async findGoalById(id: string): Promise<SavingsGoal | null> {
    return this.goalRepo.findOne({ where: { id } });
  }

  async findProgressById(id: string): Promise<SavingsProgress | null> {
    return this.progressRepo.findOne({ where: { id } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WITHDRAW
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Records a withdrawal from a savings goal.
   *
   * Flow
   * ────
   * 1. Load the goal — 404 if it doesn't exist.
   * 2. Ownership check — 403 if the caller is not the goal owner.
   * 3. Open a transaction with a pessimistic write lock on the goal row:
   *    a. Re-read savedAmount under lock (prevents concurrent over-withdraw).
   *    b. Insufficient-funds guard — 400 if amount > savedAmount.
   *    c. Decrement savedAmount (floor 0 guard as a safety net).
   *    d. Reopen goal if it was completed and balance fell below target.
   *    e. Insert SavingsWithdrawal row with a balance snapshot.
   * 4. Return the withdrawal record + newTotalSaved.
   *
   * Concurrency note
   * ────────────────
   * Two simultaneous withdrawals of 600 each from a balance of 800 would both
   * pass the funds check if they read the same pre-lock value. The row-level
   * lock (SELECT … FOR UPDATE) serialises them: the second request re-reads the
   * post-first-withdrawal balance of 200 and correctly returns 400.
   */
  async withdraw(
    goalId: string,
    userId: string,
    dto: WithdrawDto,
  ): Promise<WithdrawResponseDto> {
    // ── 1. Existence check (fast path, outside transaction) ─────────────
    const exists = await this.goalRepo.findOne({ where: { id: goalId } });
    if (!exists) {
      throw new NotFoundException(`Savings goal '${goalId}' not found.`);
    }

    // ── 2. Ownership check ───────────────────────────────────────────────
    if (exists.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this savings goal.',
      );
    }

    // ── 3. Transaction ───────────────────────────────────────────────────
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // 3a. Re-fetch with pessimistic write lock — prevents concurrent
      //     over-withdrawal by serialising balance reads.
      const goal = await queryRunner.manager
        .getRepository(SavingsGoal)
        .createQueryBuilder('goal')
        .where('goal.id = :id', { id: goalId })
        .setLock('pessimistic_write') // SELECT … FOR UPDATE
        .getOne();

      if (!goal) {
        throw new NotFoundException(`Savings goal '${goalId}' not found.`);
      }

      const currentBalance = Number(goal.savedAmount);
      const withdrawalAmount = Number(dto.amount);

      // 3b. Insufficient-funds guard — evaluated inside the lock so the
      //     check and the update are atomic.
      if (withdrawalAmount > currentBalance) {
        throw new BadRequestException(
          `Insufficient funds: cannot withdraw ${withdrawalAmount} from a balance of ${currentBalance}.`,
        );
      }

      // 3c. Decrement — Math.max(0, ...) is a defensive floor; the check
      //     above already guarantees this won't go negative.
      const newTotal = parseFloat(
        Math.max(0, currentBalance - withdrawalAmount).toFixed(2),
      );
      goal.savedAmount = newTotal;

      // 3d. Reopen goal if balance dips below target after a withdrawal.
      //     A goal that was "completed" is no longer complete once funds leave.
      if (goal.isCompleted && newTotal < Number(goal.targetAmount)) {
        goal.isCompleted = false;
        this.logger.log(
          `Goal '${goalId}' reopened — balance ${newTotal} fell below target ${goal.targetAmount}.`,
        );
      }

      await queryRunner.manager.save(SavingsGoal, goal);

      // 3e. Append the immutable withdrawal record
      const withdrawalDate = dto.date ? new Date(dto.date) : new Date();

      const withdrawal = queryRunner.manager.create(SavingsWithdrawal, {
        savingsId: goalId,
        type: 'WITHDRAWAL' as const,
        amount: withdrawalAmount,
        date: withdrawalDate,
        note: dto.note ?? null,
        savedAmountSnapshot: newTotal,
      });

      const saved = await queryRunner.manager.save(
        SavingsWithdrawal,
        withdrawal,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Withdrawal recorded: goal=${goalId} amount=${withdrawalAmount} newTotal=${newTotal}`,
      );

      // ── 4. Build response ─────────────────────────────────────────────
      return {
        id: saved.id,
        savingsId: saved.savingsId,
        type: 'WITHDRAWAL',
        amount: Number(saved.amount),
        date: saved.date.toISOString(),
        note: saved.note,
        newTotalSaved: newTotal,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Re-throw domain exceptions unchanged — they already carry the right
      // HTTP status code and should not be wrapped as 500.
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to process withdrawal for goal '${goalId}'`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Could not process withdrawal. The operation was rolled back.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findWithdrawalById(id: string): Promise<SavingsWithdrawal | null> {
    return this.withdrawalRepo.findOne({ where: { id } });
  }
}
