import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetAnalyticsDto {
  @IsOptional()
  @IsString()
  startDate?: string; // Mendukung format camelCase dari FE

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  start_date?: string; // Fallback aman mendukung format snake_case dari FE

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  range?: string; // e.g., "30_days", "custom" (jaga-jaga jika FE kirim ini)
}

export class ExportReportDto {
  @IsNotEmpty()
  @IsString()
  period!: string; // e.g., "2026-05" atau "ALL"

  @IsOptional()
  @IsString()
  range?: string;
}