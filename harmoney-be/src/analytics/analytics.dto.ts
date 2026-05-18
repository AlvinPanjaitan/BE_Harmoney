import { IsNotEmpty, IsString } from 'class-validator';

export class GetAnalyticsDto {
  @IsNotEmpty()
  @IsString()
  range: string; // e.g., "30_days", "custom"

  @IsNotEmpty()
  @IsString()
  type: string; // e.g., "expense", "income"
}

export class ExportReportDto {
  @IsNotEmpty()
  @IsString()
  range: string;

  @IsNotEmpty()
  @IsString()
  period: string;
}
