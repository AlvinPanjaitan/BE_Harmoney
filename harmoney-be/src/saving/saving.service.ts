import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SavingService {
  constructor(private readonly prisma: PrismaService) {}

  
  async findAll(userId: string) {
    const savings = await this.prisma.saving.findMany({
      where: { user_id: userId },
      include: { wallet: true },
      orderBy: { created_at: 'desc' },
    });

    const formattedData = savings.map((s: any) => {
      const target = Number(s.target_amount);
      const current = Number(s.current_amount || 0);
      const progressPercentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

      const today = new Date();
      let daysLeft = 0;
      
      if (s.target_date) {
        const dueDate = new Date(s.target_date);
        const timeDiff = dueDate.getTime() - today.getTime();
        daysLeft = Math.max(Math.ceil(timeDiff / (1000 * 60 * 60 * 24)), 0);
      }

      return {
        saving_id: s.saving_id,
        name: s.name,
        target_amount: target,
        current_amount: current,
        due_date: s.target_date,
        wallet_id: s.wallet_id,
        days_left: daysLeft,
        progress_percentage: progressPercentage,
        icon_url: s.icon || null,
      };
    });

    return {
      msg: 'Savings retrieved successfully',
      data: formattedData,
    };
  }

  
  async create(userId: string, dto: any) {
    const targetAmount = Number(dto.target_amount);
    if (targetAmount <= 0) throw new BadRequestException('Target amount must be greater than 0');

    const wallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.wallet_id, user_id: userId },
    });
    if (!wallet) throw new BadRequestException('Access denied: Wallet does not belong to this user');

    const newSaving = await this.prisma.saving.create({
      data: {
        user_id: userId,
        wallet_id: dto.wallet_id,
        name: dto.name,
        target_amount: targetAmount,
        current_amount: 0, 
        target_date: dto.end_date ? new Date(dto.end_date) : null,
        icon: dto.icon_url || null,
      },
    });

    return {
      msg: 'Saving goal created successfully',
      data: {
        saving_id: newSaving.saving_id,
        user_id: newSaving.user_id,
        name: newSaving.name,
        target_amount: Number(newSaving.target_amount),
        wallet_source: wallet.name,
      },
    };
  }

  
  async update(userId: string, id: string, dto: any) {
    const saving = await this.prisma.saving.findFirst({
      where: { saving_id: id, user_id: userId },
    });
    if (!saving) throw new NotFoundException('Saving goal not found or access denied');

    if (dto.target_amount !== undefined && Number(dto.target_amount) <= 0) {
      throw new BadRequestException('Target amount must be greater than 0');
    }

    const updatedSaving = await this.prisma.saving.update({
      where: { saving_id: id },
      data: {
        name: dto.name || saving.name,
        target_amount: dto.target_amount !== undefined ? Number(dto.target_amount) : saving.target_amount,
        target_date: dto.end_date ? new Date(dto.end_date) : saving.target_date,
      },
    });

    return {
      msg: 'Saving goal updated successfully',
      data: {
        saving_id: updatedSaving.saving_id,
        name: updatedSaving.name,
        target_amount: Number(updatedSaving.target_amount),
      },
    };
  }

  
  async remove(userId: string, id: string) {
    const saving = await this.prisma.saving.findFirst({
      where: { saving_id: id, user_id: userId },
      include: { wallet: true },
    });
    if (!saving) throw new NotFoundException('Saving goal not found or access denied');

    const remainingBalance = Number(saving.current_amount || 0);

    return this.prisma.$transaction(async (tx) => {
      if (remainingBalance > 0) {
        await tx.wallet.update({
          where: { wallet_id: saving.wallet_id },
          data: { balance: { increment: remainingBalance } },
        });
      }

      await tx.saving.delete({ where: { saving_id: id } });

      return {
        msg: `Saving goal deleted successfully. Remaining balance has been returned to ${saving.wallet.name}.`,
      };
    });
  }

  
  async addBalance(userId: string, id: string, dto: any) {
    const amount = Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Amount to add must be greater than 0');

    const saving = await this.prisma.saving.findFirst({
      where: { saving_id: id, user_id: userId },
    });
    if (!saving) throw new NotFoundException('Saving goal not found or access denied');

    const wallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.wallet_id, user_id: userId },
    });
    if (!wallet) throw new BadRequestException('Access denied: Wallet does not belong to this user');
    if (Number(wallet.balance) < amount) throw new BadRequestException('Insufficient wallet balance');

    return this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { wallet_id: dto.wallet_id },
        data: { balance: { decrement: amount } },
      });

      const updatedSaving = await tx.saving.update({
        where: { saving_id: id },
        data: { current_amount: { increment: amount } },
      });

      
      await tx.transaction.create({
        data: {
          user_id: userId,
          wallet_id: dto.wallet_id,
          category_id: null,
          type: 'EXPENSE',
          amount: amount,
          description: `Add Saving: ${saving.name}`,
          transaction_date: new Date(),
        },
      });

      const target = Number(updatedSaving.target_amount);
      const current = Number(updatedSaving.current_amount);
      const progressPercentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

      return {
        msg: 'Balance added successfully and logged in history',
        data: {
          saving_id: updatedSaving.saving_id,
          current_amount: current,
          progress_percentage: progressPercentage,
        },
      };
    });
  }

  
  async withdrawBalance(userId: string, id: string, dto: any) {
    const amount = Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Amount to withdraw must be greater than 0');

    const saving = await this.prisma.saving.findFirst({
      where: { saving_id: id, user_id: userId },
    });
    if (!saving) throw new NotFoundException('Saving goal not found or access denied');
    if (Number(saving.current_amount || 0) < amount) throw new BadRequestException('Insufficient savings balance');

    const wallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.wallet_id, user_id: userId },
    });
    if (!wallet) throw new BadRequestException('Access denied: Wallet does not belong to this user');

    return this.prisma.$transaction(async (tx) => {
      const updatedSaving = await tx.saving.update({
        where: { saving_id: id },
        data: { current_amount: { decrement: amount } },
      });

      await tx.wallet.update({
        where: { wallet_id: dto.wallet_id },
        data: { balance: { increment: amount } },
      });

      
      await tx.transaction.create({
        data: {
          user_id: userId,
          wallet_id: dto.wallet_id,
          category_id: null,
          type: 'INCOME',
          amount: amount,
          description: `Withdraw Saving: ${saving.name}`,
          transaction_date: new Date(),
        },
      });

      const target = Number(updatedSaving.target_amount);
      const current = Number(updatedSaving.current_amount);
      const progressPercentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

      return {
        msg: 'Balance withdrawn successfully and logged in history',
        data: {
          saving_id: updatedSaving.saving_id,
          current_amount: current,
          progress_percentage: progressPercentage,
        },
      };
    });
  }
}