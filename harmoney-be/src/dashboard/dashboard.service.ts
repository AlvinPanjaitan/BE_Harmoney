import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

/**
 * Dashboard Service - Business logic untuk summary endpoint.
 *
 * Tanggung jawab:
 *  - Aggregate data dari 4 tabel (users, wallets, transactions, savings)
 *  - Run query paralel via Promise.all (latency optimization)
 *  - Format response sesuai API docs Harmoney
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard summary untuk user tertentu.
   *
   * @param userId UUID user (hardcoded sementara, dari Auth nanti)
   */
  async getSummary(userId: string) {
    // -----------------------------------------------------
    // 1. Tentukan boundary bulan ini (untuk monthly aggregation)
    // -----------------------------------------------------
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // -----------------------------------------------------
    // 2. Run 6 query PARALEL via Promise.all
    // -----------------------------------------------------
    const [
      user,
      wallets,
      monthlyIncomeAgg,
      monthlyExpenseAgg,
      recentTransactions,
      savings,
    ] = await Promise.all([
      // 2a. User profile
      this.prisma.user.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          name: true,
          email: true,
          avatar_url: true,
          currency: true,
        },
      }),

      // 2b. Semua wallets user (untuk total balance + breakdown)
      this.prisma.wallet.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
        select: {
          wallet_id: true,
          name: true,
          icon: true,
          balance: true,
          currency: true,
        },
      }),

      // 2c. Sum INCOME bulan ini
      this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          type: TransactionType.INCOME,
          transaction_date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        _sum: { amount: true },
      }),

      // 2d. Sum EXPENSE bulan ini
      this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          type: TransactionType.EXPENSE,
          transaction_date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        _sum: { amount: true },
      }),

      // 2e. Recent 10 transactions (semua type)
      this.prisma.transaction.findMany({
        where: { user_id: userId },
        orderBy: { transaction_date: 'desc' },
        take: 10,
        include: {
          wallet: { select: { name: true, icon: true } },
          category: { select: { name: true, icon: true, type: true } },
        },
      }),

      // 2f. Savings goals
      this.prisma.saving.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    // -----------------------------------------------------
    // 3. Validate: user ada gak?
    // -----------------------------------------------------
    if (!user) {
      throw new NotFoundException(`User dengan ID ${userId} gak ditemukan`);
    }

    // -----------------------------------------------------
    // 4. Calculate total balance dari semua wallets
    // -----------------------------------------------------
    const totalBalance = wallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0,
    );

    // -----------------------------------------------------
    // 5. Extract monthly income & expense (handle null kalo gak ada data)
    // -----------------------------------------------------
    const monthlyIncome = Number(monthlyIncomeAgg._sum.amount ?? 0);
    const monthlyExpense = Number(monthlyExpenseAgg._sum.amount ?? 0);
    const monthlyNet = monthlyIncome - monthlyExpense;

    // -----------------------------------------------------
    // 6. Format recent transactions untuk response
    // -----------------------------------------------------
    const formattedTransactions = recentTransactions.map((tx) => ({
      transaction_id: tx.transaction_id,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      transaction_date: tx.transaction_date,
      wallet: tx.wallet
        ? { name: tx.wallet.name, icon: tx.wallet.icon }
        : null,
      category: tx.category
        ? {
            name: tx.category.name,
            icon: tx.category.icon,
            type: tx.category.type,
          }
        : null,
    }));

    // -----------------------------------------------------
    // 7. Format savings dengan calculated percentage
    // -----------------------------------------------------
    const formattedSavings = savings.map((s) => {
      const target = Number(s.target_amount);
      const current = Number(s.current_amount);
      const percentage = target > 0 ? Math.round((current / target) * 100) : 0;

      return {
        saving_id: s.saving_id,
        name: s.name,
        icon: s.icon,
        target_amount: target,
        current_amount: current,
        percentage,
        target_date: s.target_date,
      };
    });

    // -----------------------------------------------------
    // 8. Final response
    // -----------------------------------------------------
    return {
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        currency: user.currency,
      },
      balance: {
        total: totalBalance,
        currency: user.currency,
        by_wallet: wallets.map((w) => ({
          wallet_id: w.wallet_id,
          name: w.name,
          icon: w.icon,
          balance: Number(w.balance),
          currency: w.currency,
        })),
      },
      this_month: {
        income: monthlyIncome,
        expense: monthlyExpense,
        net: monthlyNet,
      },
      recent_transactions: formattedTransactions,
      savings_progress: formattedSavings,
    };
  }
}