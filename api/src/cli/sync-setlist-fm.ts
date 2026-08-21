// Manual sync command: imports The Warning's shows/setlists from setlist.fm.
//
//   npm run sync:setlist-fm
//
// Not exposed as an HTTP endpoint by design (see AGENTS.md slice notes) —
// this is an internal/manual operation for now, no cron/job runner yet.
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
