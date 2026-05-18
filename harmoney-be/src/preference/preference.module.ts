import { Module } from '@nestjs/common';
import { PreferenceService } from './preference.service';
import { PreferenceController } from './preference.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PreferenceController],
  providers: [PreferenceService],
})
export class PreferenceModule {}