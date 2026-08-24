import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { DemoSeedService } from './../src/demo-seed/demo-seed.service';

const DEMO_EXTERNAL_IDS = [
  'demo-the-warning-001',
  'demo-the-warning-002',
  'demo-the-warning-003',
  'demo-the-warning-004',
  'demo-the-warning-005',
];

// Exercises the real DemoSeedService against real Postgres — the same
// database prisma/seed.ts populates. Relies on that base catalog (the
// "the-warning" artist, and the 5 preferred demo cities) already existing,
// same assumption test/setlist-fm-sync.e2e-spec.ts makes about the artist
// slug. No HTTP client involved anywhere in this suite.
describe('Demo seed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let demoSeedService: DemoSeedService;
  let artistId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    demoSeedService = app.get(DemoSeedService);

    // "the-warning" is the artist's real, permanent slug (see
    // prisma/seed.ts) — reuse it instead of creating a second one.
    const artist = await prisma.artist.upsert({
      where: { slug: 'the-warning' },
      update: {},
      create: { name: 'The Warning', slug: 'the-warning' },
    });
    artistId = artist.id;

    // Guarantee the 5 preferred demo cities exist, matching the exact
    // catalog prisma/seed.ts already creates — upserting here is harmless
    // and keeps this suite self-sufficient even against a fresh DB.
    const countries = [
      { name: 'Argentina', code: 'AR' },
      { name: 'México', code: 'MX' },
      { name: 'Estados Unidos', code: 'US' },
    ];
    const cities = [
      { name: 'Mendoza', code: 'AR' },
      { name: 'Buenos Aires', code: 'AR' },
      { name: 'Ciudad de México', code: 'MX' },
      { name: 'Monterrey', code: 'MX' },
      { name: 'Los Angeles', code: 'US' },
    ];
    const countryIds: Record<string, string> = {};
    for (const country of countries) {
      const row = await prisma.country.upsert({
        where: { code: country.code },
        update: {},
        create: { name: country.name, code: country.code },
      });
      countryIds[country.code] = row.id;
    }
    for (const city of cities) {
      await prisma.city.upsert({
        where: {
          countryId_name: { countryId: countryIds[city.code], name: city.name },
        },
        update: {},
        create: { name: city.name, countryId: countryIds[city.code] },
      });
    }

    // Start from a known state: a previous manual `npm run seed:demo` run
    // (or a previous, interrupted test run) may have already left these
    // externalIds behind. Without this, the "creates 5 demo shows" test
    // below would see created: 0 / updated: 5 instead — a false failure
    // caused by leftover data, not by DemoSeedService.
    await deleteDemoRows();
  });

  async function deleteDemoRows() {
    await prisma.setlistSong.deleteMany({
      where: { setlist: { show: { externalId: { in: DEMO_EXTERNAL_IDS } } } },
    });
    await prisma.setlist.deleteMany({
      where: { show: { externalId: { in: DEMO_EXTERNAL_IDS } } },
    });
    await prisma.show.deleteMany({
      where: { externalId: { in: DEMO_EXTERNAL_IDS } },
    });
  }

  afterAll(async () => {
    await deleteDemoRows();
    await app.close();
  });

  it('seeds 5 demo shows with setlists, servable through the existing read endpoints', async () => {
    const summary = await demoSeedService.seedDemoTheWarning();

    expect(summary.artist).toBe('The Warning');
    expect(summary.shows.created).toBe(5);
    expect(summary.setlists.created).toBe(5);
    expect(summary.citiesSkipped).toEqual([]);

    const showsResponse = await request(app.getHttpServer())
      .get(`/artists/${artistId}/shows`)
      .expect(200);

    const demoShows = showsResponse.body.filter((show: { venue: string }) =>
      show.venue?.startsWith('Demo'),
    );
    expect(demoShows.length).toBeGreaterThanOrEqual(5);

    const mendozaShow = showsResponse.body.find(
      (show: { venue: string }) => show.venue === 'Demo Venue — Mendoza',
    );
    expect(mendozaShow).toBeDefined();
    expect(mendozaShow.city.name).toBe('Mendoza');

    const setlistResponse = await request(app.getHttpServer())
      .get(`/artists/${artistId}/shows/${mendozaShow.id}/setlist`)
      .expect(200);

    expect(setlistResponse.body.songs.length).toBeGreaterThanOrEqual(5);
    expect(setlistResponse.body.songs.length).toBeLessThanOrEqual(8);
    setlistResponse.body.songs.forEach(
      (song: { position: number }, index: number) => {
        expect(song.position).toBe(index + 1);
      },
    );
  });

  it('gives /stats/songs meaningful, repeated song data', async () => {
    await demoSeedService.seedDemoTheWarning();

    const statsResponse = await request(app.getHttpServer())
      .get(`/artists/${artistId}/stats/songs`)
      .expect(200);

    const sick = statsResponse.body.find(
      (row: { title: string }) => row.title === 'S!CK',
    );
    expect(sick).toBeDefined();
    expect(sick.timesPlayed).toBeGreaterThanOrEqual(3);
  });

  it('is idempotent: running it twice does not duplicate shows or songs', async () => {
    await demoSeedService.seedDemoTheWarning();

    const shows = await prisma.show.findMany({
      where: { externalId: { in: DEMO_EXTERNAL_IDS } },
    });
    expect(shows).toHaveLength(5);

    const secondRun = await demoSeedService.seedDemoTheWarning();
    expect(secondRun.shows.created).toBe(0);
    expect(secondRun.shows.updated).toBe(5);
    expect(secondRun.setlists.created).toBe(0);
    expect(secondRun.setlists.updated).toBe(5);

    const showsAfter = await prisma.show.findMany({
      where: { externalId: { in: DEMO_EXTERNAL_IDS } },
    });
    expect(showsAfter).toHaveLength(5);

    for (const show of showsAfter) {
      const setlist = await prisma.setlist.findUnique({
        where: { showId: show.id },
        include: { songs: true },
      });
      const positions = setlist!.songs.map((song) => song.position).sort();
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(positions.length);
    }
  });
});
