import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { SplitModule } from './split/split.module';

@Module({
  imports: [SplitModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}