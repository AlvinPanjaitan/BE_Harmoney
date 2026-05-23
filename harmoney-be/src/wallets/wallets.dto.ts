import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateWalletDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsNumber()
  balance!: number;

  @IsOptional()
  @IsString()
  icon?: string; 
}

export class UpdateWalletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}