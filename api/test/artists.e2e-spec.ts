import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Artists (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique-per-run name/slug so this suite is safe to re-run against a
  // database that already has other artists.
  const suffix = randomUUID().slice(0, 8);
  const artistName = `Zeta Artist ${suffix}`;
  const artistSlug = `zeta-artist-${suffix}`;

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

    const artist = await prisma.artist.create({
      data: { name: artistName, slug: artistSlug },
    });
    artistId = artist.id;
  });

  afterAll(async () => {
    await prisma.artist.deleteMany({ where: { id: artistId } });
    await app.close();
  });

  describe('GET /artists', () => {
    it('returns the artists including the one just created', async () => {
      const response = await request(app.getHttpServer())
        .get('/artists')
        .expect(200);

      const slugs: string[] = response.body.map(
        (artist: { slug: string }) => artist.slug,
      );
      expect(slugs).toContain(artistSlug);
    });

    it('returns the explicit response shape, without unexpected fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/artists')
        .expect(200);

      const found = response.body.find(
        (artist: { id: string }) => artist.id === artistId,
      );
      expect(found).toEqual({
        id: artistId,
        name: artistName,
        slug: artistSlug,
        imageUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('GET /artists/:id', () => {
    it('returns 200 with the artist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${artistId}`)
        .expect(200);

      expect(response.body).toEqual({
        id: artistId,
        name: artistName,
        slug: artistSlug,
        imageUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('returns 400 when the id is not a valid UUID', async () => {
      await request(app.getHttpServer()).get('/artists/not-a-uuid').expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('GET /artists/:artistId/fans', () => {
    // Su propio set de datos: dos artistas genéricos, ciudad con y sin
    // coordenadas, y fans en distintas combinaciones de visibilidad.
    // No se usa "The Warning" ni ningún artista particular en las
    // aserciones: se crean artistas y fans propios para el suite.
    const fansSuffix = randomUUID().slice(0, 8);
    const countryName = `Fans Country ${fansSuffix}`;
    const cityName = `Fans City ${fansSuffix}`;
    const cityNoCoordsName = `Fans City No Coords ${fansSuffix}`;
    const artistXName = `Fans Artist X ${fansSuffix}`;
    const artistXSlug = `fans-artist-x-${fansSuffix}`;
    const artistYName = `Fans Artist Y ${fansSuffix}`;
    const artistYSlug = `fans-artist-y-${fansSuffix}`;
    const artistZName = `Fans Artist Z ${fansSuffix}`;
    const artistZSlug = `fans-artist-z-${fansSuffix}`;

    let countryId: string;
    let cityId: string;
    let cityNoCoordsId: string;
    let artistXId: string;
    let artistYId: string;
    let artistZId: string;

    const createdUserEmails: string[] = [];

    function uniqueEmail(label: string) {
      const email = `${label}-${randomUUID()}@example.com`;
      createdUserEmails.push(email);
      return email;
    }

    async function createFan(
      label: string,
      artistIds: string[],
      showOnMap: boolean,
      fanCityId: string,
    ) {
      const email = uniqueEmail(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: `${label} Fan`,
          cityId: fanCityId,
          showOnMap,
          artistIds,
        })
        .expect(201);
      return response.body as { id: string };
    }

    beforeAll(async () => {
      const country = await prisma.country.create({
        data: { name: countryName, code: `X${fansSuffix.slice(0, 1)}` },
      });
      countryId = country.id;

      const city = await prisma.city.create({
        data: {
          name: cityName,
          countryId,
          latitude: -34.6037,
          longitude: -58.3816,
        },
      });
      cityId = city.id;

      const cityNoCoords = await prisma.city.create({
        data: { name: cityNoCoordsName, countryId },
      });
      cityNoCoordsId = cityNoCoords.id;

      const artistX = await prisma.artist.create({
        data: { name: artistXName, slug: artistXSlug },
      });
      artistXId = artistX.id;

      const artistY = await prisma.artist.create({
        data: { name: artistYName, slug: artistYSlug },
      });
      artistYId = artistY.id;

      // artistZ no tiene ningún fan asociado: cubre el caso de lista vacía.
      const artistZ = await prisma.artist.create({
        data: { name: artistZName, slug: artistZSlug },
      });
      artistZId = artistZ.id;
    });

    afterAll(async () => {
      const users = await prisma.user.findMany({
        where: { email: { in: createdUserEmails } },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);
      const fanProfiles = await prisma.fanProfile.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      await prisma.fanArtist.deleteMany({
        where: {
          fanProfileId: { in: fanProfiles.map((profile) => profile.id) },
        },
      });
      await prisma.fanProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { email: { in: createdUserEmails } } });
      await prisma.artist.deleteMany({
        where: { id: { in: [artistXId, artistYId, artistZId] } },
      });
      await prisma.city.deleteMany({
        where: { id: { in: [cityId, cityNoCoordsId] } },
      });
      await prisma.country.deleteMany({ where: { id: countryId } });
    });

    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/artists/not-a-uuid/fans?onMap=true')
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/fans?onMap=true`)
        .expect(404);
    });

    it('returns the artist and only the visible fans with city coordinates that follow it', async () => {
      const visibleFan = await createFan(
        'fans-visible',
        [artistXId],
        true,
        cityId,
      );
      const otherArtistFan = await createFan(
        'fans-other-artist',
        [artistYId],
        true,
        cityId,
      );
      const notVisibleFan = await createFan(
        'fans-not-visible',
        [artistXId],
        false,
        cityId,
      );
      const noCoordsFan = await createFan(
        'fans-no-coords',
        [artistXId],
        true,
        cityNoCoordsId,
      );

      const response = await request(app.getHttpServer())
        .get(`/artists/${artistXId}/fans?onMap=true`)
        .expect(200);

      expect(response.body.artist).toEqual({
        id: artistXId,
        name: artistXName,
        slug: artistXSlug,
        imageUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const ids: string[] = response.body.fans.map(
        (fan: { id: string }) => fan.id,
      );
      expect(ids).toContain(visibleFan.id);
      expect(ids).not.toContain(otherArtistFan.id);
      expect(ids).not.toContain(notVisibleFan.id);
      expect(ids).not.toContain(noCoordsFan.id);

      const found = response.body.fans.find(
        (fan: { id: string }) => fan.id === visibleFan.id,
      );
      expect(found).toEqual({
        id: visibleFan.id,
        displayName: 'fans-visible Fan',
        showOnMap: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        city: {
          id: cityId,
          name: cityName,
          latitude: -34.6037,
          longitude: -58.3816,
          country: {
            id: countryId,
            name: countryName,
            code: expect.any(String),
          },
        },
      });
      expect(found).not.toHaveProperty('email');
      expect(found).not.toHaveProperty('userId');
    });

    it('returns an empty fans array when the artist has no visible fans', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${artistZId}/fans?onMap=true`)
        .expect(200);

      expect(response.body.fans).toEqual([]);
    });

    it('returns 400 when onMap is not a valid boolean', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistXId}/fans?onMap=foo`)
        .expect(400);
    });
  });

  describe('Seed data', () => {
    // Mirrors the idempotent upsert in prisma/seed.ts. Not cleaned up in
    // afterAll: it represents permanent seed data, not a test fixture.
    it('seeding The Warning twice results in a single artist with that slug', async () => {
      const upsert = () =>
        prisma.artist.upsert({
          where: { slug: 'the-warning' },
          update: { name: 'The Warning' },
          create: { name: 'The Warning', slug: 'the-warning' },
        });

      await upsert();
      await upsert();

      const matches = await prisma.artist.findMany({
        where: { slug: 'the-warning' },
      });
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('The Warning');
    });

    it('exposes the seeded The Warning artist through GET /artists', async () => {
      const response = await request(app.getHttpServer())
        .get('/artists')
        .expect(200);

      const theWarning = response.body.find(
        (artist: { slug: string }) => artist.slug === 'the-warning',
      );
      expect(theWarning).toBeDefined();
      expect(theWarning.name).toBe('The Warning');
    });
  });
});
