import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard Controller - HTTP layer untuk dashboard endpoints.
 *
 * Routes:
 *   GET /api/dashboard/summary - Get user dashboard summary
 *
 * NOTE Step 7: User ID di-hardcode (sesuai SEED_USER_ID dari seed script).
 *              Step Auth (later): Ganti dengan req.user.user_id dari JWT guard.
 */
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // =====================================================
  // Hardcoded user ID - HARUS match dengan SEED_USER_ID di prisma/seed.ts
  // =====================================================
  private readonly HARDCODED_USER_ID = '11111111-1111-1111-1111-111111111111';

  /**
   * GET /api/dashboard/summary
   * 
   * Return aggregated dashboard data:
   *  - Total balance + balance per wallet
   *  - Monthly income, expense, net
   *  - Recent transactions
   *  - Savings goals progress
   */
  @Get('summary')
  async getSummary() {
    const data = await this.dashboardService.getSummary(this.HARDCODED_USER_ID);

    return {
      status: 'success',
      data,
    };
  }
}