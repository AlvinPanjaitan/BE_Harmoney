import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  
  async updatePreference(userId: string, dto: any) {
    
    if (dto.currency && !['IDR', 'USD', 'EUR', 'SGD', 'MYR'].includes(dto.currency)) {
      throw new BadRequestException('Invalid currency type');
    }

    
    if (dto.report_frequency && !['DAILY', 'WEEKLY', 'MONTHLY'].includes(dto.report_frequency)) {
      throw new BadRequestException('Invalid report frequency type');
    }

    const user: any = await this.prisma.user.findUnique({
      where: { user_id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    
    const updatedUser: any = await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        currency: dto.currency || user.currency,
        report_frequency: dto.report_frequency || user.report_frequency,
      },
    });

    return {
      msg: 'Preferences updated successfully',
      data: {
        report_frequency: updatedUser.report_frequency,
        currency: updatedUser.currency,
      },
    };
  }

  
  async resetFinanceData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({
      where: { user_id: userId },
    });

    return {
      msg: 'All transaction data has been wiped successfully.',
    };
  }
}