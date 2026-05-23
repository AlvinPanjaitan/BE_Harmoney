import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto, UpdateWalletDto } from './wallets.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async getAllWallets(@Req() req: any) {
    const data = await this.walletsService.findAll(req.user.userId);
    return { msg: 'Wallets retrieved successfully', data };
  }

  @Get(':id')
  async getWalletById(@Req() req: any, @Param('id') id: string) {
    const data = await this.walletsService.findOne(req.user.userId, id);
    return { msg: 'Wallet detail retrieved', data };
  }

  @Post()
  async createWallet(@Req() req: any, @Body() dto: CreateWalletDto) {
    const data = await this.walletsService.create(req.user.userId, dto);
    return data;
  }

  @Put(':id')
  async updateWallet(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWalletDto) {
    const data = await this.walletsService.update(req.user.userId, id, dto);
    return { msg: 'Wallet updated successfully', data };
  }

  @Delete(':id')
  async deleteWallet(@Req() req: any, @Param('id') id: string) {
    return this.walletsService.remove(req.user.userId, id);
  }
}