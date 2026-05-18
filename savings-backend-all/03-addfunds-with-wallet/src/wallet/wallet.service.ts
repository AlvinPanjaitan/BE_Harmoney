import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

/**
 * STUB WalletService — replace with the real implementation owned by the
 * wallet team. Only the methods consumed by SavingsService are stubbed:
 *
 *   • findOne()            — used for ownership lookups
 *   • debitInTransaction() — atomic debit participating in another module's tx
 *
 * Why the `debitInTransaction(qr, …)` shape?
 * ────────────────────────────────────────────
 * SavingsService.addFunds() must debit the wallet AND credit the savings goal
 * atomically. If WalletService opened its own transaction we'd end up with two
 * uncoordinated transactions — one could commit while the other rolls back,
 * losing money. Accepting a QueryRunner from the caller keeps both writes
 * inside a single SERIALIZABLE transaction.
 */
@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async findOne(walletId: number): Promise<Wallet | null> {
    return this.walletRepo.findOne({ where: { walletId } });
  }

  /**
   * Atomically debits `amount` from the specified wallet inside the
   * transaction owned by `qr`. Validates:
   *   1. Wallet exists                            → 404
   *   2. Wallet belongs to `expectedUserId`       → 403
   *   3. Wallet has sufficient balance            → 400
   *
   * Uses a pessimistic write lock so concurrent debits against the same
   * wallet are serialised — the second request reads the post-debit balance
   * and correctly rejects with 400 if funds run out.
   */
  async debitInTransaction(
    qr: QueryRunner,
    walletId: number,
    amount: number,
    expectedUserId: string,
  ): Promise<Wallet> {
    const wallet = await qr.manager
      .getRepository(Wallet)
      .createQueryBuilder('w')
      .where('w.walletId = :walletId', { walletId })
      .setLock('pessimistic_write')
      .getOne();

    if (!wallet) {
      throw new NotFoundException(`Wallet '${walletId}' not found.`);
    }

    if (wallet.userId !== expectedUserId) {
      throw new ForbiddenException(
        `Wallet '${walletId}' does not belong to the authenticated user.`,
      );
    }

    const currentBalance = Number(wallet.balance);
    if (currentBalance < amount) {
      throw new BadRequestException(
        `Insufficient balance: wallet has ${currentBalance}, attempted to debit ${amount}.`,
      );
    }

    wallet.balance = parseFloat((currentBalance - amount).toFixed(2));
    return qr.manager.save(Wallet, wallet);
  }
}
