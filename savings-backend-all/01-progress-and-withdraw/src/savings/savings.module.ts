import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsProgress } from './entities/savings-progress.entity';
import { SavingsWithdrawal } from './entities/savings-withdrawal.entity';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavingsGoal, SavingsProgress, SavingsWithdrawal]),
    AuthModule,
  ],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService],
})
export class SavingsModule {}
