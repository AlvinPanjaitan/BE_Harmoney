import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Wallet } from '../../wallet/entities/wallet.entity';

/**
 * Savings goal entity.
 *
 * Note on `double precision` for monetary fields
 * ──────────────────────────────────────────────
 * The spec asks for `double` (a 64-bit float). We honour that here, but
 * production finance code should use `numeric(14,2)` instead — floats accumulate
 * rounding errors (0.1 + 0.2 ≠ 0.3). The service compensates by rounding to
 * 2 decimal places after each arithmetic operation.
 */
@Entity('savings')
@Index(['walletId'])
export class Savings {
  /** Integer primary key — auto-incrementing (NOT a UUID per the spec). */
  @PrimaryGeneratedColumn({ type: 'int', name: 'saving_id' })
  savingId: number;

  /** FK to wallets.wallet_id — the wallet that "owns" this goal. */
  @Column({ name: 'wallet_id', type: 'int' })
  walletId: number;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ length: 120 })
  name: string;

  @Column({ name: 'target_amount', type: 'double precision' })
  targetAmount: number;

  @Column({ name: 'current_amount', type: 'double precision', default: 0 })
  currentAmount: number;

  /** Start of the savings period — addFunds is rejected before this date. */
  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  /** End of the savings period — addFunds is rejected after this date. */
  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
