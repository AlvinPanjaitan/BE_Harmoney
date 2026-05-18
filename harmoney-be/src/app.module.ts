import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { SplitModule } from './split/split.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { TransactionModule } from './transaction/transaction.module';
import { SavingModule } from './saving/saving.module';
import { PreferenceModule } from './preference/preference.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    SplitModule,
    AnalyticsModule, // Modul analytics dari temanmu sudah aman tergabung
    DashboardModule,
    AuthModule,
    TransactionModule,
    SavingModule,
    PreferenceModule, // Modul preference kamu tetap aman terjaga
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}