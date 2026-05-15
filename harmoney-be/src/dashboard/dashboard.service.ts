import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dashboard Service - Business logic untuk summary endpoint.
 *
 * Tanggung jawab:
 *  - Aggregate data dari multiple tabel (wallets, transactions, savings)
 *  - Format response sesuai API docs Harmoney
 *
 * NOTE Step 7: Method-method di sini RETURN DUMMY DATA dulu.
 *              Step 8: Replace dummy dengan query Prisma real.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard summary untuk user tertentu.
   *
   * @param userId UUID user (hardcoded sementara, dari Auth nanti)
   * @returns Summary dengan balance, monthly income/expense, recent transactions, savings progress
   */
  async getSummary(userId: string) {
    // TODO Step 8: Replace dengan query Prisma real
    return {
      user: {
        user_id: userId,
        name: 'Mikail Test',
        currency: 'IDR',
      },
      balance: {
        total: 0,
        by_wallet: [],
      },
      this_month: {
        income: 0,
        expense: 0,
        net: 0,
      },
      recent_transactions: [],
      savings_progress: [],
    };
  }
}