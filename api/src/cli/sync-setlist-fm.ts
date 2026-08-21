// Manual sync command: imports The Warning's shows/setlists from setlist.fm.
//
//   npm run sync:setlist-fm
//
// Not exposed as an HTTP endpoint by design (see AGENTS.md slice notes) —
// this is an internal/manual operation for now, no cron/job runner yet.
//
// IMPORTANT: this must be run through `ts-node` (see the npm script), not
// `tsx` or any other esbuild-based loader. This file correctly boots a real
// Nest ApplicationContext and resolves SetlistFmSyncService through DI, but
// esbuild does not implement TypeScript's `emitDecoratorMetadata` — without
// it Nest can't see SetlistFmSyncService's constructor parameter types and
// silently constructs it with zero dependencies instead of throwing. That
// showed up as `TypeError: Cannot read properties of undefined (reading
// 'artist')` inside syncTheWarning(), with PrismaService/SetlistFmClient
// both undefined. ts-node uses the real TypeScript compiler, which does
// emit this metadata. See test/sync-setlist-fm-cli.e2e-spec.ts.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SetlistFmSyncService } from '../shows/setlist-fm-sync.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const syncService = app.get(SetlistFmSyncService);
    const summary = await syncService.syncTheWarning();

    console.log('setlist.fm sync completed:');
    console.log(JSON.stringify(summary, null, 2));

    if (summary.citiesNotFound.length > 0) {
      console.warn(
        `${summary.skipped} show(s) skipped due to missing cities in the catalog.`,
      );
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('setlist.fm sync failed:');
    console.error(error);
    process.exit(1);
  });
