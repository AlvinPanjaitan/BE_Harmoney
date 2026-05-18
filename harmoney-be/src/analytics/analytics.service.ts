import { Injectable, BadRequestException } from '@nestjs/common';
import { GetAnalyticsDto, ExportReportDto } from './analytics.dto';

@Injectable()
export class AnalyticsService {
  
  async getSummary(dto: GetAnalyticsDto) {
    if (!dto || !dto.range || dto.range === 'invalid') {
      throw new BadRequestException('Invalid date range selected.');
    }

    if (!dto.type) {
      throw new BadRequestException('Invalid date range selected.');
    }

    return {
      period_label: 'Last 30 Days',
      total_amount: 10000000,
      chart_data: {
        donut: [
          { category_id: 1, category_name: 'Food and Beverage', amount: 723000, percentage: 87 },
          { category_id: 2, category_name: 'Technology', amount: 52000, percentage: 7 },
          { category_id: 3, category_name: 'Transportation', amount: 23000, percentage: 4 },
          { category_id: 4, category_name: 'Education', amount: 17000, percentage: 2 },
        ],
        bar_chart: {
          labels: ['Income', 'Expense', 'Savings'],
          values: [300000, 450000, 380000],
        },
      },
      ai_insight: {
        message: 'Your finances are not secure. You have a cash flow deficit of -Rp537.700 in this period',
      },
    };
  }

  async generateExportFile(dto: ExportReportDto): Promise<Buffer> {
    if (!dto || !dto.period || dto.period === 'empty') {
      throw new BadRequestException('No transactions found to export for this period.');
    }

    if (!dto.range) {
      throw new BadRequestException('No transactions found to export for this period.');
    }

    return Buffer.from('mock,excel,file,content,data');
  }
}
