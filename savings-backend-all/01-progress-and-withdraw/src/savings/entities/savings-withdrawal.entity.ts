import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { SavingsGoal } from './savings-goal.entity';

/**
 * Immutable record of a single withdrawal from a SavingsGoal.
 *
 * Design notes
 * ────────────
 * • Rows are append-only, matching the SavingsProgress pattern. Corrections
 *   are made by creating a compensating deposit (addProgress), not by editing.
 * • `savedAmountSnapshot` captures the goal balance *after* this withdrawal
 *   was applied — the full audit trail is readable without re-aggregating.
 * • `type` is fixed to 'WITHDRAWAL' so that a unified transaction history
 *   query can JOIN both tables and ORDER BY date without extra filtering.
 */
@Entity('savings_withdrawals')
export class SavingsWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SavingsGoal, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'savings_id' })
  goal: SavingsGoal;

  @Column({ name: 'savings_id' })
  savingsId: string;

  /**
   * Always 'WITHDRAWAL'. Stored as a column so a single ledger query
   * can UNION this table with savings_progress without extra annotation.
   */
  @Column({ length: 20, default: 'WITHDRAWAL' })
  type: 'WITHDRAWAL';

  /** Amount withdrawn — always positive; the service handles the subtraction. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  /** Caller-supplied date; defaults to NOW() when omitted in the DTO. */
  @Column({ name: 'withdrawal_date', type: 'timestamptz' })
  date: Date;

  /** Optional reason, e.g. "Emergency car repair". */
  @Column({ length: 500, nullable: true, default: null })
  note: string | null;

  /**
   * Snapshot of SavingsGoal.savedAmount *after* this row was inserted.
   * Never recalculated — historical balance queries are O(1) per row.
   */
  @Column({
    name: 'saved_amount_snapshot',
    type: 'numeric',
    precision: 14,
    scale: 2,
  })
  savedAmountSnapshot: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
