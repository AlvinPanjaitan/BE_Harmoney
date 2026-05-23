import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalletDto, UpdateWalletDto } from './wallets.dto';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  private get walletSelect() {
    return {
      wallet_id: true,
      name: true,
      balance: true,
      icon: true,
      currency: true,
      created_at: true,
      updated_at: true,
    };
  }

  async findAll(userId: string) {
    return this.prisma.wallet.findMany({
      where: { user_id: userId },
      select: this.walletSelect,
    });
  }

  async findOne(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: walletId, user_id: userId },
      select: this.walletSelect,
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async create(userId: string, dto: CreateWalletDto) {
    return this.prisma.wallet.create({
      data: {
        user_id: userId, 
        name: dto.name,
        balance: dto.balance,
        icon: dto.icon || null,
      },
      select: this.walletSelect, 
    });
  }

  
  async update(userId: string, walletId: string, dto: UpdateWalletDto) {
    await this.findOne(userId, walletId); 

    return this.prisma.wallet.update({
      where: { wallet_id: walletId },
      data: {
        name: dto.name,
        icon: dto.icon,
      },
      select: this.walletSelect, 
    });
  }

  
  async remove(userId: string, walletId: string) {
    await this.findOne(userId, walletId);
    await this.prisma.wallet.delete({
      where: { wallet_id: walletId },
    });
    return { msg: 'Wallet deleted successfully' };
  }
}