import { Controller, Post, Get, Body, Query, UseGuards, Res, HttpStatus, HttpException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { GetAnalyticsDto, ExportReportDto } from './analytics.dto';
import { AuthGuard } from './auth.guard';
import { Response } from 'express';

@Controller('api/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('summary')
  async getAnalyticsSummary(@Body() dto: GetAnalyticsDto) {
    try {
      const data = await this.analyticsService.getSummary(dto);
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
        } else {
          message = error.message;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      throw new HttpException(
        { msg: message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('export')
  async exportReport(@Query() dto: ExportReportDto, @Res() res: Response) {
    try {
      const fileData = await this.analyticsService.generateExportFile(dto);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report-${dto.period}.xlsx`);
      
      return res.status(HttpStatus.OK).send(fileData);
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
        } else {
          message = error.message;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      return res.status(HttpStatus.BAD_REQUEST).json({
        msg: message,
      });
    }
  }
}
