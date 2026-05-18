import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.transactionService.findAll(req.user.userId);
  }

  @Post('expense')
  async createExpense(@Req() req: any, @Body() dto: any) {
    return this.transactionService.createExpense(req.user.userId, dto);
  }

  @Post('income')
  async createIncome(@Req() req: any, @Body() dto: any) {
    return this.transactionService.createIncome(req.user.userId, dto);
  }

  @Post('transfer')
  async createTransfer(@Req() req: any, @Body() dto: any) {
    return this.transactionService.createTransfer(req.user.userId, dto);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.transactionService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.transactionService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.transactionService.remove(req.user.userId, id);
  }
}