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
 * Immutable record of a single contribution toward a SavingsGoal.
 *
 * Design notes
 * ────────────
 * • Rows are never updated — contributions are append-only.
 *   To "undo" a contribution, create a negative-amount correction entry.
 * • `savedAmountSnapshot` captures the goal's running total *after* this
 *   contribution was applied, giving a full audit trail without re-summing.
 */
@Entity('savings_progress')
export class SavingsProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK to savings_goals.id */
  @ManyToOne(() => SavingsGoal, (goal) => goal.progress, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'savings_id' })
  goal: SavingsGoal;

  @Column({ name: 'savings_id' })
  savingsId: string;

  /** Contribution amount — must be > 0 (enforced in DTO + service) */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  /** Caller-supplied date, defaults to NOW() when omitted */
  @Column({ name: 'contribution_date', type: 'timestamptz' })
  date: Date;

  /** Optional human note, e.g. "Monthly salary deposit" */
  @Column({ length: 500, nullable: true, default: null })
  note: string | null;

  /**
   * Snapshot of SavingsGoal.savedAmount *after* this row was inserted.
   * Stored here so historical reports don't need to re-aggregate.
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
