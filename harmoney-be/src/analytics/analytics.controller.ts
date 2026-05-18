import { Controller, Post, Get, Body, Query, UseGuards, Req, Res, HttpStatus, HttpException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { GetAnalyticsDto, ExportReportDto } from './analytics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import type { Response } from 'express';

@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('summary')
  async getAnalyticsSummary(@Req() req: any, @Body() dto: GetAnalyticsDto) {
    try {
      const data = await this.analyticsService.getSummary(req.user.userId, dto);
      return {
        msg: 'Analytics data retrieved successfully',
        data,
      };
    } catch (error) {
      let message = 'Invalid date range selected.';
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'message' in response) {
          message = Array.isArray((response as any).message)
            ? (response as any).message[0]
            : (response as any).message;
        } else if (typeof response === 'string') {
          message = response;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      throw new HttpException({ msg: message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('export')
  // 1. DIUBAH: Tambahkan { passthrough: true } agar NestJS mengizinkan manipulasi stream header Excel
  async exportReport(@Req() req: any, @Query() dto: ExportReportDto, @Res({ passthrough: true }) res: Response) {
    try {
      const fileData = await this.analyticsService.generateExportFile(req.user.userId, dto);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report-${dto.period}.xlsx`);
      
      // 2. DIUBAH: Hapus kata kunci 'return' di depan res, biarkan express mengirimkan buffer secara langsung
      res.status(HttpStatus.OK).send(fileData);
    } catch (error) {
      let message = 'No transactions found to export for this period.';
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'message' in response) {
          message = Array.isArray((response as any).message)
            ? (response as any).message[0]
            : (response as any).message;
        } else if (typeof response === 'string') {
          message = response;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      // Karena menggunakan passthrough, respons eror di dalam catch juga disesuaikan tanpa return di depan res
      res.status(HttpStatus.BAD_REQUEST).json({ msg: message });
    }
  }
}