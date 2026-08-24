import { Module } from '@nestjs/common';
import { DemoSeedService } from './demo-seed.service';

// PrismaService comes from the global PrismaModule (see
// src/database/prisma.module.ts) — no need to import it here.
@Module({
  providers: [DemoSeedService],
  exports: [DemoSeedService],
})
export class DemoSeedModule {}
