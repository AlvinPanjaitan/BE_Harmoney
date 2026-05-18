import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { SplitModule } from './split/split.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [SplitModule, AnalyticsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}