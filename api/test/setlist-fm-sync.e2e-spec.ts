import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { SetlistFmClient } from './../src/integrations/setlist-fm/setlist-fm.client';
import {
  SetlistFmSyncService,
  THE_WARNING_SETLIST_FM_MBID,
} from './../src/shows/setlist-fm-sync.service';
import { SetlistFmSetlistsPage } from './../src/integrations/setlist-fm/setlist-fm.types';

// Exercises the real sync service + real Postgres, with only the network
// call to setlist.fm replaced by a test double — never hits the real API,
// never needs a real API key. Verifies the existing read endpoints can
// serve what the sync persists.
describe('setlist.fm sync (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let syncService: SetlistFmSyncService;
  let getArtistSetlists: jest.Mock;

  const suffix = randomUUID().slice(0, 8);
  const countryCode = `SYNC${suffix}`.toUpperCase();
  const cityName = `Sync City ${suffix}`;
  const externalIdWithSetlist = `sync-ext-${suffix}-1`;
  const externalIdWithoutSetlist = `sync-ext-${suffix}-2`;

  let artistId: string;
  let countryId: string;
  let cityId: string;

  function fakePage(): SetlistFmSetlistsPage {
    return {
      setlist: [
        {
          id: externalIdWithSetlist,
          versionId: 'v1',
          eventDate: '10-04-2026',
          artist: { mbid: THE_WARNING_SETLIST_FM_MBID, name: 'The Warning' },
          venue: {
            id: 'venue-1',
            name: 'Sync Venue',
            city: {
              id: 'sfm-city-1',
              name: cityName,
              country: {
                code: countryCode.toLowerCase(),
                name: 'Sync Country',
              },
            },
          },
          set: [{ song: [{ name: 'First Song' }, { name: 'Second Song' }] }],
          url: 'https://www.setlist.fm/setlist/sync-ext-1.html',
        },
        {
          id: externalIdWithoutSetlist,
          versionId: 'v1',
          eventDate: '11-04-2026',
          artist: { mbid: THE_WARNING_SETLIST_FM_MBID, name: 'The Warning' },
          venue: {
            id: 'venue-2',
            name: 'Sync Venue Without Setlist',
            city: {
              id: 'sfm-city-1',
              name: cityName,
              country: {
                code: countryCode.toLowerCase(),
                name: 'Sync Country',
              },
            },
          },
          set: [],
          url: 'https://www.setlist.fm/setlist/sync-ext-2.html',
        },
      ],
      total: 2,
      page: 1,
      itemsPerPage: 20,
    };
  }

  beforeAll(async () => {
    getArtistSetlists = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SetlistFmClient)
      .useValue({ getArtistSetlists })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    syncService = app.get(SetlistFmSyncService);

    // "the-warning" is the artist's real, permanent slug (see prisma/seed.ts)
    // — reuse it instead of creating a second artist with the same slug.
    const artist = await prisma.artist.upsert({
      where: { slug: 'the-warning' },
      update: {},
      create: { name: 'The Warning', slug: 'the-warning' },
    });
    artistId = artist.id;

    const country = await prisma.country.create({
      data: { name: `Sync Country ${suffix}`, code: countryCode },
    });
    countryId = country.id;

    const city = await prisma.city.create({
      data: { name: cityName, countryId, latitude: 1.23, longitude: 4.56 },
    });
    cityId = city.id;
  });

  afterAll(async () => {
    await prisma.setlistSong.deleteMany({
      where: {
        setlist: {
          show: {
            externalId: {
              in: [externalIdWithSetlist, externalIdWithoutSetlist],
            },
          },
        },
      },
    });
    await prisma.setlist.deleteMany({
      where: {
        show: {
          externalId: {
            in: [externalIdWithSetlist, externalIdWithoutSetlist],
          },
        },
      },
    });
    await prisma.show.deleteMany({
      where: {
        externalId: { in: [externalIdWithSetlist, externalIdWithoutSetlist] },
      },
    });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  it('persists shows and setlists so the existing read endpoints can serve them', async () => {
    getArtistSetlists.mockResolvedValue(fakePage());

    const summary = await syncService.syncTheWarning();

    expect(summary.fetched).toBe(2);
    expect(summary.created).toBe(2);
    expect(summary.setlistsCreated).toBe(1);
    expect(summary.setlistsUpdated).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.citiesNotFound).toEqual([]);

    const showsResponse = await request(app.getHttpServer())
      .get(`/artists/${artistId}/shows`)
      .expect(200);

    const withSetlist = showsResponse.body.find(
      (show: { venue: string }) => show.venue === 'Sync Venue',
    );
    const withoutSetlist = showsResponse.body.find(
      (show: { venue: string }) => show.venue === 'Sync Venue Without Setlist',
    );
    expect(withSetlist).toBeDefined();
    expect(withoutSetlist).toBeDefined();
    expect(withSetlist.city.name).toBe(cityName);
    expect(withSetlist.city.country.code).toBe(countryCode);

    const setlistResponse = await request(app.getHttpServer())
      .get(`/artists/${artistId}/shows/${withSetlist.id}/setlist`)
      .expect(200);

    expect(setlistResponse.body.songs).toEqual([
      { id: expect.any(String), position: 1, title: 'First Song' },
      { id: expect.any(String), position: 2, title: 'Second Song' },
    ]);

    const emptySetlistResponse = await request(app.getHttpServer())
      .get(`/artists/${artistId}/shows/${withoutSetlist.id}/setlist`)
      .expect(200);
    expect(emptySetlistResponse.body.songs).toEqual([]);
  });

  it('is idempotent: syncing again does not duplicate shows or songs', async () => {
    getArtistSetlists.mockResolvedValue(fakePage());

    const summary = await syncService.syncTheWarning();

    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(2);
    expect(summary.setlistsCreated).toBe(0);
    expect(summary.setlistsUpdated).toBe(1);

    const shows = await prisma.show.findMany({
      where: {
        externalId: { in: [externalIdWithSetlist, externalIdWithoutSetlist] },
      },
    });
    expect(shows).toHaveLength(2);

    const showWithSetlist = shows.find(
      (show) => show.externalId === externalIdWithSetlist,
    )!;
    const setlist = await prisma.setlist.findUnique({
      where: { showId: showWithSetlist.id },
      include: { songs: true },
    });
    expect(setlist?.songs).toHaveLength(2);
  });

  describe('Database constraint', () => {
    it('rejects two shows sharing the same externalId', async () => {
      const duplicateExternalId = `dup-${suffix}`;
      await prisma.show.create({
        data: {
          artistId,
          cityId,
          date: new Date('2026-01-01T00:00:00.000Z'),
          externalId: duplicateExternalId,
        },
      });

      await expect(
        prisma.show.create({
          data: {
            artistId,
            cityId,
            date: new Date('2026-01-02T00:00:00.000Z'),
            externalId: duplicateExternalId,
          },
        }),
      ).rejects.toThrow();

      await prisma.show.deleteMany({
        where: { externalId: duplicateExternalId },
      });
    });
  });
});
