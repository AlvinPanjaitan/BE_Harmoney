import { Controller, Post, Body, UseGuards, Req, Put } from '@nestjs/common';
import { PreferenceService } from './preference.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  
  @Put('users/preference')
  async updatePreference(@Req() req: any, @Body() dto: any) {
    return this.preferenceService.updatePreference(req.user.userId, dto);
  }

  
  @Post('user/reset-data')
  async resetData(@Req() req: any) {
    return this.preferenceService.resetFinanceData(req.user.userId);
  }
}