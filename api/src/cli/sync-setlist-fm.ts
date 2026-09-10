// Manual sync command: imports The Warning's shows/setlists from setlist.fm.
//
//   npm run sync:setlist-fm
//
// Not exposed as an HTTP endpoint by design (see AGENTS.md slice notes) —
// this is an internal/manual operation for now, no cron/job runner yet
// (besides the unattended weekly GitHub Actions cron — see
// .github/workflows/sync-setlist-fm.yml — which is exactly why a 429 here
// gets a few retries instead of just failing outright; see
// setlist-fm-retry.ts).
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
import {
  DEFAULT_SETLIST_FM_RETRY_DELAYS_MS,
  withSetlistFmRetry,
} from '../integrations/setlist-fm/setlist-fm-retry';
import { SetlistFmSyncService } from '../shows/setlist-fm-sync.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    console.log('Starting Setlist.fm sync for The Warning');

    const syncService = app.get(SetlistFmSyncService);
    // syncTheWarning() itself never retries a 429 (see setlist-fm.client.ts
    // and setlist-fm-sync.service.ts) — withSetlistFmRetry is the one layer
    // that does, re-running the whole sync from scratch after a backoff.
    // That's safe: nothing gets persisted until every page has fetched
    // successfully, so a 429 partway through has nothing to duplicate on
    // retry. See setlist-fm-retry.ts for why a 429 here usually isn't this
    // run's own fault.
    const summary = await withSetlistFmRetry(
      () =>
        syncService.syncTheWarning({
          onPageFetchStart: (page) => console.log(`Fetching page ${page}...`),
        }),
      {
        onRetry: (attempt, delayMs) =>
          console.warn(
            `setlist.fm rate-limited (429); retrying in ${Math.round(delayMs / 1000)}s ` +
              `(attempt ${attempt}/${DEFAULT_SETLIST_FM_RETRY_DELAYS_MS.length})...`,
          ),
      },
    );

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
  .catch((error: unknown) => {
    console.error('setlist.fm sync failed:');
    // Never log config (e.g. SetlistFmConfigError carries no secret, but we
    // still only ever log the Error itself, never process.env) — the daily
    // rate-limit error (see SetlistFmRateLimiter) is a plain Error with a
    // clear "setlist.fm daily rate limit reached" message, so it surfaces
    // here just like any other sync failure, with no special-casing needed.
    console.error(error);
    process.exit(1);
  });
