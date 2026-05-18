import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { SavingService } from './saving.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/savings')
@UseGuards(JwtAuthGuard)
export class SavingController {
  constructor(private readonly savingService: SavingService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.savingService.findAll(req.user.userId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    return this.savingService.create(req.user.userId, dto);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.savingService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.savingService.remove(req.user.userId, id);
  }

  @Post(':id/add')
  async addBalance(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.savingService.addBalance(req.user.userId, id, dto);
  }

  @Post(':id/withdraw')
  async withdrawBalance(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.savingService.withdrawBalance(req.user.userId, id, dto);
  }
}