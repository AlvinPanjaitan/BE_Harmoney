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
import { Savings } from './entities/savings.entity';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { WalletService } from '../wallet/wallet.service';
import { Wallet } from '../wallet/entities/wallet.entity';

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(
    @InjectRepository(Savings)
    private readonly savingsRepo: Repository<Savings>,

    private readonly walletService: WalletService,

    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new savings goal owned by the authenticated user.
   * Confirms that the linked wallet exists and belongs to that user.
   */
  async create(userId: string, dto: CreateSavingsDto): Promise<Savings> {
    // 1. Verify the linked wallet exists and is owned by this user
    const wallet = await this.walletService.findOne(dto.walletId);
    if (!wallet) {
      throw new NotFoundException(`Wallet '${dto.walletId}' not found.`);
    }
    if (wallet.userId !== userId) {
      throw new ForbiddenException(
        `Wallet '${dto.walletId}' does not belong to the authenticated user.`,
      );
    }

    // 2. Validate the date window
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException(
        'endDate must be strictly after startDate.',
      );
    }

    const goal = this.savingsRepo.create({
      walletId: dto.walletId,
      name: dto.name,
      targetAmount: dto.targetAmount,
      currentAmount: 0,
      startDate,
      endDate,
    });

    return this.savingsRepo.save(goal);
  }

  /**
   * Returns the savings goal by id, enforcing that the calling user owns the
   * linked wallet. Throws 404 if missing, 403 on cross-tenant access.
   */
  async findOne(savingId: number, userId: string): Promise<Savings> {
    const saving = await this.savingsRepo.findOne({
      where: { savingId },
      relations: ['wallet'],
    });
    if (!saving) {
      throw new NotFoundException(`Savings goal '${savingId}' not found.`);
    }
    if (saving.wallet.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this savings goal.',
      );
    }
    return saving;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REQUIRED — addFunds
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transfers `amount` from `fromWalletId` into the savings goal's
   * currentAmount. All writes happen in a single SERIALIZABLE transaction so
   * a partial failure can never leave the wallet debited but the savings
   * un-credited (or vice versa).
   *
   * The spec's signature is `addFunds(savingId, amount, fromWalletId)`. We
   * accept `userId` as a fourth parameter so the service can enforce that the
   * caller owns both the savings goal and the source wallet — pushing this
   * check up to the controller risks inconsistent enforcement across callers.
   *
   * Validations
   * ───────────
   *   • amount > 0                              → 400
   *   • Savings goal exists                     → 404
   *   • now is within [startDate, endDate]      → 400 (goal not active)
   *   • Caller owns the savings goal's wallet   → 403
   *   • Source wallet exists                    → 404
   *   • Source wallet owned by caller           → 403
   *     (implies it's owned by the same user as the savings goal)
   *   • Source wallet has sufficient balance    → 400
   *
   * Concurrency
   * ───────────
   * Both rows (savings + wallet) are loaded with `SELECT ... FOR UPDATE`,
   * which prevents two concurrent calls from each reading the same balance
   * and both passing the funds check on stale data.
   */
  async addFunds(
    savingId: number,
    amount: number,
    fromWalletId: number,
    userId: string,
  ): Promise<void> {
    // ── 0. Cheap input guard before opening a transaction ─────────────────
    if (!(amount > 0)) {
      throw new BadRequestException('amount must be greater than 0.');
    }

    // ── Transaction ───────────────────────────────────────────────────────
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');

    try {
      // 1. Lock and load the savings goal
      const saving = await qr.manager
        .getRepository(Savings)
        .createQueryBuilder('s')
        .where('s.savingId = :savingId', { savingId })
        .setLock('pessimistic_write')
        .getOne();

      if (!saving) {
        throw new NotFoundException(`Savings goal '${savingId}' not found.`);
      }

      // 2. Verify the goal is currently active (within its window)
      const now = new Date();
      if (now < saving.startDate) {
        throw new BadRequestException(
          `Savings goal '${savingId}' has not started yet (starts ${saving.startDate.toISOString()}).`,
        );
      }
      if (now > saving.endDate) {
        throw new BadRequestException(
          `Savings goal '${savingId}' has ended (ended ${saving.endDate.toISOString()}).`,
        );
      }

      // 3. Verify the caller owns the savings goal (via its linked wallet)
      const ownerWallet = await qr.manager.findOne(Wallet, {
        where: { walletId: saving.walletId },
      });
      if (!ownerWallet) {
        // Shouldn't happen due to FK constraints, but guard anyway.
        throw new NotFoundException(
          `Owner wallet for savings goal '${savingId}' not found.`,
        );
      }
      if (ownerWallet.userId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to add funds to this savings goal.',
        );
      }

      // 4. Debit the source wallet inside this same transaction.
      //    WalletService verifies (a) source wallet exists, (b) belongs to
      //    `userId` — transitively the same user as the savings goal — and
      //    (c) has sufficient balance, all under a row-level lock.
      await this.walletService.debitInTransaction(
        qr,
        fromWalletId,
        amount,
        userId,
      );

      // 5. Credit the savings goal
      const previousAmount = Number(saving.currentAmount);
      const newAmount = parseFloat((previousAmount + amount).toFixed(2));
      saving.currentAmount = newAmount;
      await qr.manager.save(Savings, saving);

      // 6. Commit
      await qr.commitTransaction();

      this.logger.log(
        `addFunds: savingId=${savingId} fromWallet=${fromWalletId} amount=${amount} newTotal=${newAmount}`,
      );
    } catch (error) {
      await qr.rollbackTransaction();

      // Re-throw domain exceptions unchanged
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `addFunds failed for savingId=${savingId}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Could not add funds. The operation was rolled back.',
      );
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REQUIRED — calculateProgress
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the goal's progress as a decimal in [0, 1+] — e.g. 0.75 means 75%.
   * Values > 1 are possible (the goal can be overfunded) and are returned as-is.
   *
   * Edge cases
   * ──────────
   *   • Savings goal not found  → NotFoundException (404)
   *   • targetAmount is 0       → returns 0 (avoids division by zero)
   *   • currentAmount is 0      → returns 0
   *   • Negative currentAmount  → returns 0 (defensive; should never happen)
   */
  async calculateProgress(savingId: number): Promise<number> {
    const saving = await this.savingsRepo.findOne({
      where: { savingId },
    });

    if (!saving) {
      throw new NotFoundException(`Savings goal '${savingId}' not found.`);
    }

    const target = Number(saving.targetAmount);
    const current = Number(saving.currentAmount);

    // Edge case: target is 0 → progress undefined → return 0
    if (target <= 0) {
      return 0;
    }

    // Defensive: clamp negative current to 0
    if (current <= 0) {
      return 0;
    }

    // Round to 4 decimal places so we get e.g. 0.7532 not 0.7531999999999999
    return parseFloat((current / target).toFixed(4));
  }
}
