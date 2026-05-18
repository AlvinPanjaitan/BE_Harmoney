import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavingsGoal]),
    AuthModule, // re-exports PassportModule so JwtAuthGuard resolves here
  ],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService], // exported so other modules (e.g. dashboard) can reuse
})
export class SavingsModule {}
