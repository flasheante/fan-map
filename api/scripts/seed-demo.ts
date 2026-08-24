// Manual demo-data command: loads enough shows/setlists for The Warning
// into Postgres to exercise the artist's shows, setlists and stats
// (including /stats/songs) without depending on setlist.fm.
//
//   npm run seed:demo
//
// All the actual logic (data, city resolution, idempotent persistence) is
// in DemoSeedService — this file just boots a Nest ApplicationContext,
// resolves it, and prints the summary. Not exposed as an HTTP endpoint by
// design, same as src/cli/sync-setlist-fm.ts.
//
// IMPORTANT: this must be run through `ts-node` (see the npm script), not
// `tsx` or any other esbuild-based loader. esbuild does not implement
// TypeScript's `emitDecoratorMetadata`, so without it Nest can't see
// DemoSeedService's constructor parameter types and silently constructs it
// with PrismaService undefined instead of throwing — see
// src/cli/sync-setlist-fm.ts for the full explanation of this failure mode,
// and test/seed-demo-cli.e2e-spec.ts for the regression test.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DemoSeedService } from '../src/demo-seed/demo-seed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const seedService = app.get(DemoSeedService);
    const summary = await seedService.seedDemoTheWarning();

    console.log('Demo seed completed');
    console.log('');
    console.log(`Artist: ${summary.artist}`);
    console.log('');
    console.log('Shows:');
    console.log(`  created: ${summary.shows.created}`);
    console.log(`  updated: ${summary.shows.updated}`);
    console.log('');
    console.log('Setlists:');
    console.log(`  created: ${summary.setlists.created}`);
    console.log(`  updated: ${summary.setlists.updated}`);
    console.log('');
    console.log('Songs:');
    console.log(`  created: ${summary.songs.created}`);
    console.log(`  updated: ${summary.songs.updated}`);
    console.log('');
    console.log('Cities skipped:');
    if (summary.citiesSkipped.length === 0) {
      console.log('  (none)');
    } else {
      for (const city of summary.citiesSkipped) {
        console.log(`  - ${city}`);
      }
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo seed failed:');
    console.error(error);
    process.exit(1);
  });
