import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule - Global module yang expose PrismaService ke semua module.
 *
 * Pattern: @Global() bikin PrismaService available di app tanpa harus
 * import PrismaModule di setiap module yang butuh.
 *
 * Cara pakai di service lain:
 *   constructor(private readonly prisma: PrismaService) {}
 *   // Lalu: this.prisma.user.findMany()
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}