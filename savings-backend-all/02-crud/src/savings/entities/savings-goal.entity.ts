import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Status of a savings goal lifecycle.
 *
 * • ACTIVE    – user is still contributing
 * • COMPLETED – marked done (manually via PATCH or by hitting the target)
 *
 * Stored as a PostgreSQL enum so the column itself rejects invalid values
 * even if a future code path bypasses the DTO validators.
 */
export enum SavingsStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

/**
 * A single savings goal owned by exactly one user.
 *
 * The userId column is indexed because the most common query in this module
 * — "find all my savings" — filters on it.
 */
@Entity('savings_goals')
@Index(['userId', 'status']) // composite index for filtered list queries
export class SavingsGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner's UUID — matches `sub` in the JWT payload. */
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 100 })
  name: string;

  /**
   * `numeric(14,2)` rather than `float` so currency math is exact.
   * Up to 999,999,999,999.99 — plenty of headroom for any realistic goal.
   */
  @Column({ name: 'target_amount', type: 'numeric', precision: 14, scale: 2 })
  targetAmount: number;

  /**
   * Running total of contributions minus withdrawals.
   * Owned by the contribution / withdrawal endpoints, NOT by CRUD —
   * PATCH cannot directly modify this field (filtered out in the service).
   */
  @Column({
    name: 'current_saved',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  currentSaved: number;

  /** Optional target date the user wants to reach the goal by. */
  @Column({ type: 'timestamptz', nullable: true })
  deadline: Date | null;

  /** Optional free-text description. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: SavingsStatus,
    default: SavingsStatus.ACTIVE,
  })
  status: SavingsStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
