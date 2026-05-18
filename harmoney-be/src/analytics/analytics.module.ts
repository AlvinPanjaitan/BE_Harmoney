import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [AnalyticsController, UsersController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
