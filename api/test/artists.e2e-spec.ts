import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { sign } from 'cookie-signature';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { AuthService } from './../src/auth/auth.service';
import { SessionService } from './../src/auth/session.service';
import { SESSION_COOKIE_NAME } from './../src/auth/auth.constants';

describe('Artists (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let sessionService: SessionService;

  // POST /fan-profiles requiere sesión (ver Etapa 2 — integración de
  // FanProfiles con Auth). Los fixtures de este suite crean fans como
  // datos de apoyo para los endpoints de Artists, así que necesitan una
  // sesión real igual que fan-profiles.e2e-spec.ts / auth.e2e-spec.ts, sin
  // pegarle a Google.
  const sessionSecret = process.env.SESSION_SECRET ?? 'dev-insecure-session-secret';

  function signedCookieHeader(sessionId: string): string {
    const signed = `s:${sign(sessionId, sessionSecret)}`;
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`;
  }

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
    app.use(cookieParser(sessionSecret));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    sessionService = app.get(SessionService);

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
    const createdSessionIds: string[] = [];

    async function authenticatedUser(label: string) {
      const email = `${label}-${randomUUID()}@example.com`;
      createdUserEmails.push(email);

      const user = await authService.findOrCreateFromGoogle({
        googleId: `google-${label}-${randomUUID()}`,
        email,
        name: label,
        emailVerified: true,
      });

      const session = await sessionService.create(user.id);
      createdSessionIds.push(session.id);

      return signedCookieHeader(session.id);
    }

    async function createFan(
      label: string,
      artistIds: string[],
      showOnMap: boolean,
      fanCityId: string,
    ) {
      const cookie = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
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
      // Session referencia al User por FK: hay que borrarla antes que el User.
      await prisma.session.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
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

  describe('GET /artists/:artistId/stats', () => {
    // Su propio set de datos: dos artistas, países/ciudades/shows/setlists
    // propios. No se usa "The Warning" en las aserciones.
    const statsSuffix = randomUUID().slice(0, 8);
    const countryAName = `Stats Country A ${statsSuffix}`;
    const countryBName = `Stats Country B ${statsSuffix}`;
    const cityA1Name = `Stats City A1 ${statsSuffix}`;
    const cityA2Name = `Stats City A2 ${statsSuffix}`;
    const cityB1Name = `Stats City B1 ${statsSuffix}`;
    const artistName = `Stats Artist ${statsSuffix}`;
    const artistSlug = `stats-artist-${statsSuffix}`;
    const otherArtistName = `Stats Other Artist ${statsSuffix}`;
    const otherArtistSlug = `stats-other-artist-${statsSuffix}`;
    const emptyArtistName = `Stats Empty Artist ${statsSuffix}`;
    const emptyArtistSlug = `stats-empty-artist-${statsSuffix}`;

    let countryAId: string;
    let countryBId: string;
    let cityA1Id: string;
    let cityA2Id: string;
    let cityB1Id: string;
    let statsArtistId: string;
    let otherArtistId: string;
    let emptyArtistId: string;

    const createdUserEmails: string[] = [];
    const createdSessionIds: string[] = [];

    async function authenticatedUser(label: string) {
      const email = `${label}-${randomUUID()}@example.com`;
      createdUserEmails.push(email);

      const user = await authService.findOrCreateFromGoogle({
        googleId: `google-${label}-${randomUUID()}`,
        email,
        name: label,
        emailVerified: true,
      });

      const session = await sessionService.create(user.id);
      createdSessionIds.push(session.id);

      return signedCookieHeader(session.id);
    }

    async function createFan(
      label: string,
      artistIds: string[],
      fanCityId: string,
    ) {
      const cookie = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: `${label} Fan`,
          cityId: fanCityId,
          showOnMap: true,
          artistIds,
        })
        .expect(201);
      return response.body as { id: string };
    }

    beforeAll(async () => {
      const countryA = await prisma.country.create({
        data: { name: countryAName, code: `A${statsSuffix.slice(0, 1)}` },
      });
      countryAId = countryA.id;

      const countryB = await prisma.country.create({
        data: { name: countryBName, code: `B${statsSuffix.slice(0, 1)}` },
      });
      countryBId = countryB.id;

      const cityA1 = await prisma.city.create({
        data: { name: cityA1Name, countryId: countryAId },
      });
      cityA1Id = cityA1.id;

      const cityA2 = await prisma.city.create({
        data: { name: cityA2Name, countryId: countryAId },
      });
      cityA2Id = cityA2.id;

      const cityB1 = await prisma.city.create({
        data: { name: cityB1Name, countryId: countryBId },
      });
      cityB1Id = cityB1.id;

      const artist = await prisma.artist.create({
        data: { name: artistName, slug: artistSlug },
      });
      statsArtistId = artist.id;

      const otherArtist = await prisma.artist.create({
        data: { name: otherArtistName, slug: otherArtistSlug },
      });
      otherArtistId = otherArtist.id;

      // emptyArtist no tiene fans, shows ni setlists: cubre el caso de
      // artista existente sin datos (todos los valores en 0).
      const emptyArtist = await prisma.artist.create({
        data: { name: emptyArtistName, slug: emptyArtistSlug },
      });
      emptyArtistId = emptyArtist.id;

      // Fans del artista: fan1 y fan2 comparten cityA1 (misma ciudad, mismo
      // país) y deben deduplicar ciudad/país; fan3 está en cityA2 (otra
      // ciudad, mismo país que fan1/fan2); fan4 está en cityB1 (otro país).
      await createFan('stats-fan-1', [statsArtistId], cityA1Id);
      await createFan('stats-fan-2', [statsArtistId], cityA1Id);
      await createFan('stats-fan-3', [statsArtistId], cityA2Id);
      await createFan('stats-fan-4', [statsArtistId], cityB1Id);
      // Fan de otro artista: no debe contaminar las stats de statsArtist.
      await createFan('stats-fan-other-artist', [otherArtistId], cityA1Id);

      // Shows del artista, con setlists que comparten una canción ("Song A")
      // para ejercitar la deduplicación de canciones.
      const show1 = await prisma.show.create({
        data: {
          artistId: statsArtistId,
          cityId: cityA1Id,
          date: new Date('2026-06-01T00:00:00.000Z'),
        },
      });
      const setlist1 = await prisma.setlist.create({
        data: { showId: show1.id },
      });
      await prisma.setlistSong.createMany({
        data: [
          { setlistId: setlist1.id, title: 'Song A', position: 1 },
          { setlistId: setlist1.id, title: 'Song B', position: 2 },
        ],
      });

      const show2 = await prisma.show.create({
        data: {
          artistId: statsArtistId,
          cityId: cityA2Id,
          date: new Date('2026-07-01T00:00:00.000Z'),
        },
      });
      const setlist2 = await prisma.setlist.create({
        data: { showId: show2.id },
      });
      await prisma.setlistSong.createMany({
        data: [
          { setlistId: setlist2.id, title: 'Song A', position: 1 },
          { setlistId: setlist2.id, title: 'Song C', position: 2 },
        ],
      });

      // Show y setlist de otro artista: no deben contaminar las stats de
      // statsArtist.
      const otherShow = await prisma.show.create({
        data: {
          artistId: otherArtistId,
          cityId: cityA1Id,
          date: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const otherSetlist = await prisma.setlist.create({
        data: { showId: otherShow.id },
      });
      await prisma.setlistSong.create({
        data: { setlistId: otherSetlist.id, title: 'Other Artist Song', position: 1 },
      });
    });

    afterAll(async () => {
      const artistIds = [statsArtistId, otherArtistId, emptyArtistId];

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
      // Session referencia al User por FK: hay que borrarla antes que el User.
      await prisma.session.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
      await prisma.user.deleteMany({ where: { email: { in: createdUserEmails } } });

      await prisma.setlistSong.deleteMany({
        where: { setlist: { show: { artistId: { in: artistIds } } } },
      });
      await prisma.setlist.deleteMany({
        where: { show: { artistId: { in: artistIds } } },
      });
      await prisma.show.deleteMany({ where: { artistId: { in: artistIds } } });
      await prisma.artist.deleteMany({ where: { id: { in: artistIds } } });
      await prisma.city.deleteMany({
        where: { id: { in: [cityA1Id, cityA2Id, cityB1Id] } },
      });
      await prisma.country.deleteMany({
        where: { id: { in: [countryAId, countryBId] } },
      });
    });

    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/artists/not-a-uuid/stats')
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/stats`)
        .expect(404);
    });

    it('returns all zeros when the artist has no data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${emptyArtistId}/stats`)
        .expect(200);

      expect(response.body).toEqual({
        fans: 0,
        countries: 0,
        cities: 0,
        shows: 0,
        songs: 0,
      });
    });

    it('returns fans/countries/cities/shows/songs scoped to the artist, correctly deduplicated', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${statsArtistId}/stats`)
        .expect(200);

      expect(response.body).toEqual({
        fans: 4,
        countries: 2,
        cities: 3,
        shows: 2,
        songs: 3,
      });
    });

    it('does not mix in data from other artists', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${otherArtistId}/stats`)
        .expect(200);

      expect(response.body).toEqual({
        fans: 1,
        countries: 1,
        cities: 1,
        shows: 1,
        songs: 1,
      });
    });
  });

  describe('GET /artists/:artistId/stats/songs', () => {
    // Su propio set de datos: dos artistas, shows/setlists/canciones
    // propios. No se usa "The Warning" en las aserciones.
    const topSongsSuffix = randomUUID().slice(0, 8);
    const countryName = `Top Songs Country ${topSongsSuffix}`;
    const cityName = `Top Songs City ${topSongsSuffix}`;
    const artistName = `Top Songs Artist ${topSongsSuffix}`;
    const artistSlug = `top-songs-artist-${topSongsSuffix}`;
    const otherArtistName = `Top Songs Other Artist ${topSongsSuffix}`;
    const otherArtistSlug = `top-songs-other-artist-${topSongsSuffix}`;
    const emptyArtistName = `Top Songs Empty Artist ${topSongsSuffix}`;
    const emptyArtistSlug = `top-songs-empty-artist-${topSongsSuffix}`;
    const noSetlistArtistName = `Top Songs No Setlist Artist ${topSongsSuffix}`;
    const noSetlistArtistSlug = `top-songs-no-setlist-artist-${topSongsSuffix}`;

    let countryId: string;
    let cityId: string;
    let topSongsArtistId: string;
    let otherArtistId: string;
    let emptyArtistId: string;
    let noSetlistArtistId: string;

    beforeAll(async () => {
      const country = await prisma.country.create({
        data: { name: countryName, code: `T${topSongsSuffix.slice(0, 1)}` },
      });
      countryId = country.id;

      const city = await prisma.city.create({
        data: { name: cityName, countryId },
      });
      cityId = city.id;

      const artist = await prisma.artist.create({
        data: { name: artistName, slug: artistSlug },
      });
      topSongsArtistId = artist.id;

      const otherArtist = await prisma.artist.create({
        data: { name: otherArtistName, slug: otherArtistSlug },
      });
      otherArtistId = otherArtist.id;

      // emptyArtist no tiene shows ni setlists: cubre el caso de artista
      // existente sin datos ([]).
      const emptyArtist = await prisma.artist.create({
        data: { name: emptyArtistName, slug: emptyArtistSlug },
      });
      emptyArtistId = emptyArtist.id;

      // noSetlistArtist tiene un show pero sin setlist asociado: también
      // debe devolver [].
      const noSetlistArtist = await prisma.artist.create({
        data: { name: noSetlistArtistName, slug: noSetlistArtistSlug },
      });
      noSetlistArtistId = noSetlistArtist.id;
      await prisma.show.create({
        data: {
          artistId: noSetlistArtistId,
          cityId,
          date: new Date('2026-05-01T00:00:00.000Z'),
        },
      });

      // Shows del artista, con canciones repetidas entre shows ("S!CK" y
      // "MORE") para ejercitar la suma de apariciones, y un empate de
      // apariciones ("Alpha" y "CHOKE", ambas con 1) para ejercitar el
      // desempate por title ASC.
      const show1 = await prisma.show.create({
        data: {
          artistId: topSongsArtistId,
          cityId,
          date: new Date('2026-06-01T00:00:00.000Z'),
        },
      });
      const setlist1 = await prisma.setlist.create({
        data: { showId: show1.id },
      });
      await prisma.setlistSong.createMany({
        data: [
          { setlistId: setlist1.id, title: 'S!CK', position: 1 },
          { setlistId: setlist1.id, title: 'MORE', position: 2 },
          { setlistId: setlist1.id, title: 'CHOKE', position: 3 },
        ],
      });

      const show2 = await prisma.show.create({
        data: {
          artistId: topSongsArtistId,
          cityId,
          date: new Date('2026-07-01T00:00:00.000Z'),
        },
      });
      const setlist2 = await prisma.setlist.create({
        data: { showId: show2.id },
      });
      await prisma.setlistSong.createMany({
        data: [
          { setlistId: setlist2.id, title: 'S!CK', position: 1 },
          { setlistId: setlist2.id, title: 'MORE', position: 2 },
        ],
      });

      const show3 = await prisma.show.create({
        data: {
          artistId: topSongsArtistId,
          cityId,
          date: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const setlist3 = await prisma.setlist.create({
        data: { showId: show3.id },
      });
      await prisma.setlistSong.createMany({
        data: [
          { setlistId: setlist3.id, title: 'S!CK', position: 1 },
          { setlistId: setlist3.id, title: 'Alpha', position: 2 },
        ],
      });

      // Show y setlist de otro artista: no deben aparecer en las top songs
      // de topSongsArtist.
      const otherShow = await prisma.show.create({
        data: {
          artistId: otherArtistId,
          cityId,
          date: new Date('2026-08-15T00:00:00.000Z'),
        },
      });
      const otherSetlist = await prisma.setlist.create({
        data: { showId: otherShow.id },
      });
      await prisma.setlistSong.create({
        data: {
          setlistId: otherSetlist.id,
          title: 'Other Artist Song',
          position: 1,
        },
      });
    });

    afterAll(async () => {
      const artistIds = [
        topSongsArtistId,
        otherArtistId,
        emptyArtistId,
        noSetlistArtistId,
      ];

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
    });

    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/artists/not-a-uuid/stats/songs')
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/stats/songs`)
        .expect(404);
    });

    it('returns [] when the artist has no shows', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${emptyArtistId}/stats/songs`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns [] when the artist has shows but no setlists', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${noSetlistArtistId}/stats/songs`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('sums appearances across shows, orders by timesPlayed desc with title asc as tiebreak, and excludes other artists', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${topSongsArtistId}/stats/songs`)
        .expect(200);

      expect(response.body).toEqual([
        { title: 'S!CK', timesPlayed: 3 },
        { title: 'MORE', timesPlayed: 2 },
        { title: 'Alpha', timesPlayed: 1 },
        { title: 'CHOKE', timesPlayed: 1 },
      ]);

      const titles: string[] = response.body.map(
        (song: { title: string }) => song.title,
      );
      expect(titles).not.toContain('Other Artist Song');
    });

    it('returns only the other artist song for the other artist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${otherArtistId}/stats/songs`)
        .expect(200);

      expect(response.body).toEqual([
        { title: 'Other Artist Song', timesPlayed: 1 },
      ]);
    });
  });

  describe('GET /artists/:artistId/songs', () => {
    // Catálogo canónico (MusicBrainz), no el ranking de tocadas en vivo —
    // ver el describe de arriba, que es otra cosa. Su propio set de datos.
    const catalogSuffix = randomUUID().slice(0, 8);
    const artistName = `Catalog Artist ${catalogSuffix}`;
    const artistSlug = `catalog-artist-${catalogSuffix}`;
    const otherArtistName = `Catalog Other Artist ${catalogSuffix}`;
    const otherArtistSlug = `catalog-other-artist-${catalogSuffix}`;

    let catalogArtistId: string;
    let otherArtistId: string;
    let songAId: string;
    let songBId: string;
    let otherArtistSongId: string;

    beforeAll(async () => {
      const artist = await prisma.artist.create({
        data: { name: artistName, slug: artistSlug },
      });
      catalogArtistId = artist.id;

      const otherArtist = await prisma.artist.create({
        data: { name: otherArtistName, slug: otherArtistSlug },
      });
      otherArtistId = otherArtist.id;

      const songB = await prisma.song.create({
        data: {
          artistId: catalogArtistId,
          title: `Catalog Song B ${catalogSuffix}`,
          albumTitle: 'Album Two',
          mbid: `catalog-mbid-b-${catalogSuffix}`,
        },
      });
      songBId = songB.id;

      const songA = await prisma.song.create({
        data: {
          artistId: catalogArtistId,
          title: `Catalog Song A ${catalogSuffix}`,
          albumTitle: 'Album One',
          mbid: `catalog-mbid-a-${catalogSuffix}`,
        },
      });
      songAId = songA.id;

      const otherArtistSong = await prisma.song.create({
        data: {
          artistId: otherArtistId,
          title: `Other Artist Catalog Song ${catalogSuffix}`,
          mbid: `catalog-mbid-other-${catalogSuffix}`,
        },
      });
      otherArtistSongId = otherArtistSong.id;
    });

    afterAll(async () => {
      await prisma.song.deleteMany({
        where: { id: { in: [songAId, songBId, otherArtistSongId] } },
      });
      await prisma.artist.deleteMany({
        where: { id: { in: [catalogArtistId, otherArtistId] } },
      });
    });

    it('returns the songs for the given artist, sorted by title', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${catalogArtistId}/songs`)
        .expect(200);

      expect(response.body).toEqual([
        {
          id: songAId,
          title: `Catalog Song A ${catalogSuffix}`,
          albumTitle: 'Album One',
          releaseDate: null,
        },
        {
          id: songBId,
          title: `Catalog Song B ${catalogSuffix}`,
          albumTitle: 'Album Two',
          releaseDate: null,
        },
      ]);
    });

    it('does not mix in songs from another artist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/artists/${catalogArtistId}/songs`)
        .expect(200);

      const ids: string[] = response.body.map((song: { id: string }) => song.id);
      expect(ids).not.toContain(otherArtistSongId);
    });

    it('returns 400 when the artistId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/artists/not-a-uuid/songs')
        .expect(400);
    });

    it('returns 404 when the artist does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${randomUUID()}/songs`)
        .expect(404);
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
