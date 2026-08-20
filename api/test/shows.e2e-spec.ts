import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Shows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Datos propios del suite: no depende de "The Warning" ni de ningún
  // artista particular en las aserciones.
  const suffix = randomUUID().slice(0, 8);
  const countryName = `Shows Country ${suffix}`;
  const cityName = `Shows City ${suffix}`;
  const artistName = `Shows Artist ${suffix}`;
  const artistSlug = `shows-artist-${suffix}`;
  const otherArtistName = `Shows Other Artist ${suffix}`;
  const otherArtistSlug = `shows-other-artist-${suffix}`;
  const noShowsArtistName = `Shows No Shows Artist ${suffix}`;
  const noShowsArtistSlug = `shows-no-shows-artist-${suffix}`;

  let countryId: string;
  let cityId: string;
  let artistId: string;
  let otherArtistId: string;
  let noShowsArtistId: string;

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

    const country = await prisma.country.create({
      data: { name: countryName, code: `S${suffix.slice(0, 1).toUpperCase()}` },
    });
    countryId = country.id;

    const city = await prisma.city.create({
      data: {
        name: cityName,
        countryId,
        latitude: 19.4326,
        longitude: -99.1332,
      },
    });
    cityId = city.id;

    const artist = await prisma.artist.create({
      data: { name: artistName, slug: artistSlug },
    });
    artistId = artist.id;

    const otherArtist = await prisma.artist.create({
      data: { name: otherArtistName, slug: otherArtistSlug },
    });
    otherArtistId = otherArtist.id;

    const noShowsArtist = await prisma.artist.create({
      data: { name: noShowsArtistName, slug: noShowsArtistSlug },
    });
    noShowsArtistId = noShowsArtist.id;
  });

  afterAll(async () => {
    const artistIds = [artistId, otherArtistId, noShowsArtistId];
    await prisma.setlistSong.deleteMany({
      where: { setlist: { show: { artistId: { in: artistIds } } } },
    });
    await prisma.setlist.deleteMany({
      where: { show: { artistId: { in: artistIds } } },
    });
    await prisma.show.deleteMany({ where: { artistId: { in: artistIds } } });
    await prisma.artist.deleteMany({ where: { id: { in: artistIds } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  describe('GET /artists/:artistId/shows', () => {
    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/artists/not-a-uuid/shows')
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/shows`)
        .expect(404);
    });

    it('returns an empty array when the artist has no shows', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${noShowsArtistId}/shows`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns the shows for the artist ordered chronologically, including the city', async () => {
      const later = await prisma.show.create({
        data: {
          artistId,
          cityId,
          date: new Date('2026-06-01T00:00:00.000Z'),
          venue: 'Later Venue',
        },
      });
      const earlier = await prisma.show.create({
        data: {
          artistId,
          cityId,
          date: new Date('2026-03-01T00:00:00.000Z'),
          venue: null,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows`)
        .expect(200);

      const ids: string[] = response.body.map(
        (show: { id: string }) => show.id,
      );
      expect(ids).toEqual([earlier.id, later.id]);

      const found = response.body.find(
        (show: { id: string }) => show.id === earlier.id,
      );
      expect(found).toEqual({
        id: earlier.id,
        date: earlier.date.toISOString(),
        venue: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        city: {
          id: cityId,
          name: cityName,
          latitude: 19.4326,
          longitude: -99.1332,
          country: { id: countryId, name: countryName, code: expect.any(String) },
        },
      });
    });
  });

  describe('GET /artists/:artistId/shows/:showId', () => {
    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get(`/artists/not-a-uuid/shows/${randomUUID()}`)
        .expect(400);
    });

    it('returns 400 when the showId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/not-a-uuid`)
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/shows/${randomUUID()}`)
        .expect(404);
    });

    it('returns 404 when the show does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/${randomUUID()}`)
        .expect(404);
    });

    it('returns 404 when the show belongs to a different artist', async () => {
      const show = await prisma.show.create({
        data: { artistId, cityId, date: new Date('2026-04-01T00:00:00.000Z') },
      });

      await request(app.getHttpServer())
        .get(`/artists/${otherArtistId}/shows/${show.id}`)
        .expect(404);
    });

    it('returns 200 with the show, including its city', async () => {
      const show = await prisma.show.create({
        data: {
          artistId,
          cityId,
          date: new Date('2026-05-01T00:00:00.000Z'),
          venue: 'Foro Sol',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/${show.id}`)
        .expect(200);

      expect(response.body).toEqual({
        id: show.id,
        date: show.date.toISOString(),
        venue: 'Foro Sol',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        city: {
          id: cityId,
          name: cityName,
          latitude: 19.4326,
          longitude: -99.1332,
          country: { id: countryId, name: countryName, code: expect.any(String) },
        },
      });
    });
  });

  describe('GET /artists/:artistId/shows/:showId/setlist', () => {
    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get(`/artists/not-a-uuid/shows/${randomUUID()}/setlist`)
        .expect(400);
    });

    it('returns 400 when the showId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/not-a-uuid/setlist`)
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/shows/${randomUUID()}/setlist`)
        .expect(404);
    });

    it('returns 404 when the show does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/${randomUUID()}/setlist`)
        .expect(404);
    });

    it('returns 404 when the show belongs to a different artist', async () => {
      const show = await prisma.show.create({
        data: { artistId, cityId, date: new Date('2026-04-05T00:00:00.000Z') },
      });

      await request(app.getHttpServer())
        .get(`/artists/${otherArtistId}/shows/${show.id}/setlist`)
        .expect(404);
    });

    it('returns 200 with an empty songs array when no setlist has been entered yet', async () => {
      const show = await prisma.show.create({
        data: { artistId, cityId, date: new Date('2026-04-10T00:00:00.000Z') },
      });

      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/${show.id}/setlist`)
        .expect(200);

      expect(response.body).toEqual({ showId: show.id, songs: [] });
    });

    it('returns 200 with an empty songs array when the setlist exists but has no songs', async () => {
      const show = await prisma.show.create({
        data: { artistId, cityId, date: new Date('2026-04-11T00:00:00.000Z') },
      });
      await prisma.setlist.create({ data: { showId: show.id } });

      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/${show.id}/setlist`)
        .expect(200);

      expect(response.body).toEqual({ showId: show.id, songs: [] });
    });

    it('returns the songs ordered by position', async () => {
      const show = await prisma.show.create({
        data: { artistId, cityId, date: new Date('2026-04-12T00:00:00.000Z') },
      });
      const setlist = await prisma.setlist.create({
        data: { showId: show.id },
      });
      await prisma.setlistSong.createMany({
        data: [
          { setlistId: setlist.id, title: 'Second Song', position: 2 },
          { setlistId: setlist.id, title: 'First Song', position: 1 },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}/shows/${show.id}/setlist`)
        .expect(200);

      expect(response.body.showId).toBe(show.id);
      expect(response.body.songs).toEqual([
        { id: expect.any(String), position: 1, title: 'First Song' },
        { id: expect.any(String), position: 2, title: 'Second Song' },
      ]);
    });
  });

  describe('Database constraint', () => {
    it('rejects a setlist song with position <= 0', async () => {
      const show = await prisma.show.create({
        data: { artistId, cityId, date: new Date('2026-04-20T00:00:00.000Z') },
      });
      const setlist = await prisma.setlist.create({
        data: { showId: show.id },
      });

      await expect(
        prisma.setlistSong.create({
          data: { setlistId: setlist.id, title: 'Invalid Position', position: 0 },
        }),
      ).rejects.toThrow();
    });
  });
});
