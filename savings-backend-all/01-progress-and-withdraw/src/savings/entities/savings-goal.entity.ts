import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Forward-declare to avoid circular import; TypeORM resolves at runtime.
import { SavingsProgress } from './savings-progress.entity';

/**
 * Represents a single savings goal belonging to a user.
 *
 * Columns
 * ───────
 * userId       – owner (FK to users table; stored as plain UUID here so this
 *                module stays self-contained without importing UserEntity)
 * name         – human-readable label, e.g. "Emergency Fund"
 * targetAmount – the goal the user is trying to reach
 * savedAmount  – running total of all contributions (updated on each POST)
 * currency     – ISO 4217 code
 * deadline     – optional target date
 * isCompleted  – flipped to true when savedAmount >= targetAmount
 */
@Entity('savings_goals')
export class SavingsGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner's UUID — matches `sub` in the JWT payload */
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ name: 'target_amount', type: 'numeric', precision: 14, scale: 2 })
  targetAmount: number;

  /**
   * Running total — updated atomically in the same transaction that
   * inserts the SavingsProgress row, so they are always in sync.
   */
  @Column({
    name: 'saved_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  savedAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'deadline', type: 'timestamptz', nullable: true })
  deadline: Date | null;

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  @OneToMany(() => SavingsProgress, (p) => p.goal, { cascade: false })
  progress: SavingsProgress[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
