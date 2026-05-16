import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  
  async findAll(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { user_id: userId },
      include: {
        wallet: true,       
        target_wallet: true, 
        category: true,      
      },
      orderBy: { transaction_date: 'desc' },
    });

    let totalIn = 0;
    let totalOut = 0;
    let totalIncomeCat = 0;
    let totalExpenseCat = 0;
    let totalTransferCat = 0;

    const formattedData = transactions.map((t: any) => {
      const amountNum = Number(t.amount);
      if (t.type === 'INCOME') {
        totalIn += amountNum;
        totalIncomeCat += amountNum;
      } else if (t.type === 'EXPENSE') {
        totalOut += amountNum;
        totalExpenseCat += amountNum;
      } else if (t.type === 'TRANSFER') {
        totalTransferCat += amountNum;
      }

      return {
        transaction_id: t.transaction_id,
        user_id: t.user_id,
        amount: amountNum,
        transaction_type: t.type,
        date: t.transaction_date,
        description: t.description,
        wallet: t.wallet ? { wallet_id: t.wallet.wallet_id, name: t.wallet.name } : null,
        target_wallet: t.target_wallet ? { wallet_id: t.target_wallet.wallet_id, name: t.target_wallet.name } : null,
        category: t.category ? { category_id: t.category.category_id, name: t.category.name, icon: t.category.icon } : null
      };
    });

    return {
      msg: 'Transactions retrieved successfully',
      summary: { total_in: totalIn, total_out: totalOut },
      categories: {
        total_income: totalIncomeCat,
        total_expense: totalExpenseCat,
        total_transfer: totalTransferCat,
      },
      data: formattedData,
    };
  }

  
  async createExpense(userId: string, dto: any) {
    const amount = Number(dto.amount);

    if (dto.category_id) {
      const category = await this.prisma.category.findFirst({
        where: { category_id: dto.category_id, user_id: userId },
      });
      if (!category) throw new BadRequestException('Access denied: Category does not belong to this user');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.wallet_id, user_id: userId },
    });
    if (!wallet) throw new BadRequestException('Access denied: Wallet does not belong to this user');
    if (Number(wallet.balance) < amount) throw new BadRequestException('Insufficient wallet balance');

    return this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { wallet_id: dto.wallet_id },
        data: { balance: { decrement: amount } },
      });

      const txRecord = await tx.transaction.create({
        data: {
          user_id: userId,
          wallet_id: dto.wallet_id,
          category_id: dto.category_id || null,
          type: 'EXPENSE',
          amount: amount,
          description: dto.description || null,
          transaction_date: dto.date ? new Date(dto.date) : new Date(),
        },
        include: { wallet: true, category: true }
      });

      return {
        msg: 'Expense recorded successfully',
        data: {
          transaction_id: txRecord.transaction_id,
          amount: Number(txRecord.amount),
          transaction_type: txRecord.type,
          date: txRecord.transaction_date,
          description: txRecord.description,
          updated_balance: Number(updatedWallet.balance),
          wallet: { wallet_id: txRecord.wallet.wallet_id, name: txRecord.wallet.name },
          category: txRecord.category ? { category_id: txRecord.category.category_id, name: txRecord.category.name, icon: txRecord.category.icon } : null
        },
      };
    });
  }

  

  async createIncome(userId: string, dto: any) {
    const amount = Number(dto.amount);

    if (dto.category_id) {
      const category = await this.prisma.category.findFirst({
        where: { category_id: dto.category_id, user_id: userId },
      });
      if (!category) throw new BadRequestException('Access denied: Category does not belong to this user');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.wallet_id, user_id: userId },
    });
    if (!wallet) throw new BadRequestException('Access denied: Wallet does not belong to this user');

    return this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { wallet_id: dto.wallet_id },
        data: { balance: { increment: amount } },
      });

      const txRecord = await tx.transaction.create({
        data: {
          user_id: userId,
          wallet_id: dto.wallet_id,
          category_id: dto.category_id || null,
          type: 'INCOME',
          amount: amount,
          description: dto.description || null,
          transaction_date: dto.date ? new Date(dto.date) : new Date(),
        },
        include: { wallet: true, category: true }
      });

      return {
        msg: 'Income recorded successfully',
        data: {
          transaction_id: txRecord.transaction_id,
          amount: Number(txRecord.amount),
          transaction_type: txRecord.type,
          date: txRecord.transaction_date,
          description: txRecord.description,
          updated_balance: Number(updatedWallet.balance),
          wallet: { wallet_id: txRecord.wallet.wallet_id, name: txRecord.wallet.name },
          category: txRecord.category ? { category_id: txRecord.category.category_id, name: txRecord.category.name, icon: txRecord.category.icon } : null
        },
      };
    });
  }

  

  async createTransfer(userId: string, dto: any) {
    const amount = Number(dto.amount);

    const sourceWallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.wallet_id, user_id: userId },
    });
    if (!sourceWallet) throw new BadRequestException('Access denied: Source wallet does not belong to this user');
    if (Number(sourceWallet.balance) < amount) throw new BadRequestException('Insufficient wallet balance');

    const targetWallet = await this.prisma.wallet.findFirst({
      where: { wallet_id: dto.to_wallet_id, user_id: userId },
    });
    if (!targetWallet) throw new BadRequestException('Access denied: Target wallet does not belong to this user');

    return this.prisma.$transaction(async (tx) => {
      const updatedSource = await tx.wallet.update({
        where: { wallet_id: dto.wallet_id },
        data: { balance: { decrement: amount } },
      });

      const updatedTarget = await tx.wallet.update({
        where: { wallet_id: dto.to_wallet_id },
        data: { balance: { increment: amount } },
      });

      const txRecord = await tx.transaction.create({
        data: {
          user_id: userId,
          wallet_id: dto.wallet_id,
          target_wallet_id: dto.to_wallet_id,
          category_id: dto.category_id || null,
          type: 'TRANSFER',
          amount: amount,
          description: dto.description || null,
          transaction_date: dto.date ? new Date(dto.date) : new Date(),
        },
        include: { wallet: true, target_wallet: true }
      });

      return {
        msg: 'Transfer processed successfully',
        data: {
          transaction_id: txRecord.transaction_id,
          amount: Number(txRecord.amount),
          transaction_type: txRecord.type,
          date: txRecord.transaction_date,
          description: txRecord.description,
          source_wallet_new_balance: Number(updatedSource.balance),
          target_wallet_new_balance: Number(updatedTarget.balance),
          from_wallet: { wallet_id: txRecord.wallet.wallet_id, name: txRecord.wallet.name },
          to_wallet: txRecord.target_wallet ? { wallet_id: txRecord.target_wallet.wallet_id, name: txRecord.target_wallet.name } : null
        },
      };
    });
  }

  

  async findOne(userId: string, id: string) {
    const t = await this.prisma.transaction.findFirst({
      where: { transaction_id: id, user_id: userId },
      include: { wallet: true, target_wallet: true, category: true }
    });
    if (!t) throw new NotFoundException('Transaction not found or access denied');

    return {
      msg: 'Transaction found',
      data: {
        transaction_id: t.transaction_id,
        user_id: t.user_id,
        amount: Number(t.amount),
        transaction_type: t.type,
        date: t.transaction_date,
        description: t.description,
        wallet: { wallet_id: t.wallet.wallet_id, name: t.wallet.name },
        to_wallet: t.target_wallet ? { wallet_id: t.target_wallet.wallet_id, name: t.target_wallet.name } : null,
        category: t.category ? { category_id: t.category.category_id, name: t.category.name, icon: t.category.icon } : null
      },
    };
  }

  

  async update(userId: string, id: string, dto: any) {
    const t = await this.prisma.transaction.findFirst({
      where: { transaction_id: id, user_id: userId },
    });
    if (!t) throw new NotFoundException('Transaction not found or access denied');

    const oldAmount = Number(t.amount);
    const newAmount = dto.amount !== undefined ? Number(dto.amount) : oldAmount;

    return this.prisma.$transaction(async (tx) => {
      
      if (t.type === 'EXPENSE') {
        await tx.wallet.update({ where: { wallet_id: t.wallet_id }, data: { balance: { increment: oldAmount } } });
      } else if (t.type === 'INCOME') {
        await tx.wallet.update({ where: { wallet_id: t.wallet_id }, data: { balance: { decrement: oldAmount } } });
      }

      
      let finalWallet;
      if (t.type === 'EXPENSE') {
        finalWallet = await tx.wallet.update({
          where: { wallet_id: t.wallet_id },
          data: { balance: { decrement: newAmount } },
        });
      } else {
        finalWallet = await tx.wallet.update({
          where: { wallet_id: t.wallet_id },
          data: { balance: { increment: newAmount } },
        });
      }

      const updatedTx = await tx.transaction.update({
        where: { transaction_id: id },
        data: {
          description: dto.name || t.description,
          amount: newAmount,
          category_id: dto.category_id || t.category_id,
        },
        include: { wallet: true, category: true }
      });

      return {
        msg: 'Transaction updated successfully',
        data: {
          transaction_id: updatedTx.transaction_id,
          name: updatedTx.description,
          amount: Number(updatedTx.amount),
          transaction_type: updatedTx.type,
          date: updatedTx.transaction_date,
          updated_wallet_balance: Number(finalWallet.balance),
          wallet: { wallet_id: updatedTx.wallet.wallet_id, name: updatedTx.wallet.name },
          category: updatedTx.category ? { category_id: updatedTx.category.category_id, name: updatedTx.category.name, icon: updatedTx.category.icon } : null
        },
      };
    });
  }

  
  async remove(userId: string, id: string) {
    const t = await this.prisma.transaction.findFirst({
      where: { transaction_id: id, user_id: userId },
    });
    if (!t) throw new NotFoundException('Transaction not found or access denied');

    const amount = Number(t.amount);

    return this.prisma.$transaction(async (tx) => {
      if (t.type === 'EXPENSE') {
        await tx.wallet.update({ where: { wallet_id: t.wallet_id }, data: { balance: { increment: amount } } });
      } else if (t.type === 'INCOME') {
        await tx.wallet.update({ where: { wallet_id: t.wallet_id }, data: { balance: { decrement: amount } } });
      } else if (t.type === 'TRANSFER' && t.target_wallet_id) {
        await tx.wallet.update({ where: { wallet_id: t.wallet_id }, data: { balance: { increment: amount } } });
        await tx.wallet.update({ where: { wallet_id: t.target_wallet_id }, data: { balance: { decrement: amount } } });
      }

      await tx.transaction.delete({ where: { transaction_id: id } });

      return { msg: 'Transaction deleted and wallet balance restored' };
    });
  }
}