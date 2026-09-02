// Manual sync command: imports The Warning's song catalog from MusicBrainz.
//
//   npm run sync:musicbrainz
//
// Not exposed as an HTTP endpoint by design (see AGENTS.md slice notes,
// same as sync-setlist-fm.ts) — this is an internal/manual operation for
// now, no cron/job runner yet. A band releases new music a handful of times
// a year at most, so there's no need to automate this.
//
// IMPORTANT: must run through `ts-node` (see the npm script), not `tsx` or
// any other esbuild-based loader — same reason as sync-setlist-fm.ts: this
// boots a real Nest ApplicationContext and resolves MusicBrainzSyncService
// through DI, which needs TypeScript's real `emitDecoratorMetadata`.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MusicBrainzSyncService } from '../songs/musicbrainz-sync.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    console.log('Starting MusicBrainz sync for The Warning');

    const syncService = app.get(MusicBrainzSyncService);
    const summary = await syncService.syncTheWarning({
      onReleaseGroupFetchStart: (title) =>
        console.log(`Fetching "${title}"...`),
    });

    console.log('MusicBrainz sync completed:');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('MusicBrainz sync failed:');
    console.error(error);
    process.exit(1);
  });
