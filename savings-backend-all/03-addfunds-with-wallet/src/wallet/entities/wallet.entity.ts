import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * MINIMAL Wallet entity — provided so the Savings module compiles and tests
 * in isolation. In production this entity (and the full WalletService) live
 * in their own module owned by another team. Replace this stub with the real
 * import path when integrating.
 *
 * The Savings module only depends on three fields:
 *   • walletId  – primary key, integer
 *   • userId    – owner UUID matching the JWT `sub` claim
 *   • balance   – current available balance
 */
@Entity('wallets')
@Index(['userId'])
export class Wallet {
  @PrimaryGeneratedColumn({ type: 'int', name: 'wallet_id' })
  walletId: number;

  /** Owner UUID — matches `sub` in the JWT payload. */
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 120, default: 'Default Wallet' })
  name: string;

  @Column({ type: 'double precision', default: 0 })
  balance: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
