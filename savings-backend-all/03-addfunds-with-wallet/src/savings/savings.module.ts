import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Savings } from './entities/savings.entity';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Savings]),
    WalletModule, // exports WalletService (consumed by SavingsService)
    AuthModule,   // re-exports PassportModule for JwtAuthGuard
  ],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService],
})
export class SavingsModule {}
