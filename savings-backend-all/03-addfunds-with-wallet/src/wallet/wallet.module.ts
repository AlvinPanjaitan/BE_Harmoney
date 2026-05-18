import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletService } from './wallet.service';

/**
 * STUB WalletModule. The real module would also export a WalletController,
 * deposit/transfer endpoints, etc. The Savings module imports this for the
 * `WalletService` injection token.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Wallet])],
  providers: [WalletService],
  exports: [WalletService, TypeOrmModule], // export TypeOrmModule so other features can inject Wallet repo if needed
})
export class WalletModule {}
