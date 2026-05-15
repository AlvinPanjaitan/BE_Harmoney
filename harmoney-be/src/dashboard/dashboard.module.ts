import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard Module - Aggregate dashboard endpoint.
 *
 * Note: PrismaService dependency resolved via global PrismaModule
 *       (registered di AppModule Step 5).
 *       Gak perlu import PrismaModule di sini.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}