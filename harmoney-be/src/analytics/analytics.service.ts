import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetAnalyticsDto, ExportReportDto } from './analytics.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  
  async getSummary(userId: string, dto: GetAnalyticsDto) {
    const { startDate, endDate } = dto as any;
    const finalStartDate = startDate || (dto as any).start_date;
    const finalEndDate = endDate || (dto as any).end_date;

    if (!finalStartDate || !finalEndDate) {
      throw new BadRequestException('Start date and end date are required.');
    }

    if (new Date(finalStartDate) > new Date(finalEndDate)) {
      throw new BadRequestException('Start date cannot be after end date.');
    }

    
    const transactions = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        transaction_date: {
          gte: new Date(finalStartDate),
          lte: new Date(finalEndDate),
        },
      },
      include: {
        category: true, 
      },
    });

    
    const periodLabel = "Last 30 Days"; 

    
    if (!transactions || transactions.length === 0) {
      return {
        period_label: periodLabel,
        total_amount: 0,
        chart_data: {
          donut: [],
          bar_chart: {
            labels: ["Income", "Expense", "Savings"],
            values: [0, 0, 0]
          }
        }
      };
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let totalAmountAll = 0; 

    
    const categoryMap = new Map<number, { id: number; name: string; amount: number }>();

    transactions.forEach((tx) => {
      const amount = Number(tx.amount);
      totalAmountAll += amount;

      if (tx.type === 'INCOME') {
        totalIncome += amount;
      } else if (tx.type === 'EXPENSE') {
        totalExpense += amount;

        
        if (tx.category) {
          const catId = tx.category.category_id || (tx.category as any).id;
          const catName = tx.category.name || (tx.category as any).category_name || "Uncategorized";
          
          if (categoryMap.has(catId)) {
            categoryMap.get(catId)!.amount += amount;
          } else {
            categoryMap.set(catId, { id: catId, name: catName, amount: amount });
          }
        }
      }
    });

    
    const donutData = Array.from(categoryMap.values()).map((item) => {
      const percentage = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
      return {
        category_id: item.id,
        category_name: item.name,
        amount: item.amount,
        percentage: percentage,
      };
    });

    
    const netSavings = totalIncome - totalExpense;

    return {
      period_label: periodLabel,
      total_amount: totalAmountAll,
      chart_data: {
        donut: donutData,
        bar_chart: {
          labels: ["Income", "Expense", "Savings"],
          values: [totalIncome, totalExpense, netSavings < 0 ? 0 : netSavings]
        }
      }
    };
  }

  
  async generateExportFile(userId: string, dto: ExportReportDto) {
    const transactions = await this.prisma.transaction.findMany({
      where: { user_id: userId },
      orderBy: { transaction_date: 'desc' },
    });

    if (!transactions || transactions.length === 0) {
      throw new BadRequestException('No transactions found to export for this user.');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Report');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
    ];

    transactions.forEach((tx) => {
      worksheet.addRow({
        date: tx.transaction_date.toISOString().split('T')[0],
        type: tx.type,
        amount: Number(tx.amount),
        description: tx.description || '-',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}