import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService - Lifecycle-managed wrapper around PrismaClient.
 *
 * Tanggung jawab:
 *  - Extend PrismaClient (langsung pake semua method: .user.findMany(), dll)
 *  - Connect ke DB saat NestJS startup (onModuleInit)
 *  - Disconnect saat NestJS shutdown (onModuleDestroy) buat graceful exit
 *
 * Pattern: https://docs.nestjs.com/recipes/prisma#use-prisma-client-in-your-nestjs-services
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Connect ke DB saat NestJS bootstrap
    await this.$connect();
  }

  async onModuleDestroy() {
    // Disconnect saat NestJS shutdown (Ctrl+C / process kill)
    await this.$disconnect();
  }
}