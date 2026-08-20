import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('FanProfiles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const countryName = `Fan Country ${suffix}`;
  const cityName = `Fan City ${suffix}`;
  const secondCityName = `Fan City 2 ${suffix}`;

  const artistAName = `Fan Artist A ${suffix}`;
  const artistASlug = `fan-artist-a-${suffix}`;
  const artistBName = `Fan Artist B ${suffix}`;
  const artistBSlug = `fan-artist-b-${suffix}`;

  let countryId: string;
  let cityId: string;
  let secondCityId: string;
  let artistAId: string;
  let artistBId: string;

  // ids/emails created by individual tests, cleaned up in afterAll.
  const createdUserEmails: string[] = [];

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
      data: { name: countryName, code: `F${suffix.slice(0, 1)}` },
    });
    countryId = country.id;

    const city = await prisma.city.create({
      data: { name: cityName, countryId, latitude: -32.89, longitude: -68.84 },
    });
    cityId = city.id;

    const secondCity = await prisma.city.create({
      data: { name: secondCityName, countryId },
    });
    secondCityId = secondCity.id;

    const artistA = await prisma.artist.create({
      data: { name: artistAName, slug: artistASlug },
    });
    artistAId = artistA.id;

    const artistB = await prisma.artist.create({
      data: { name: artistBName, slug: artistBSlug },
    });
    artistBId = artistB.id;
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
      where: { fanProfileId: { in: fanProfiles.map((profile) => profile.id) } },
    });
    await prisma.fanProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { email: { in: createdUserEmails } } });
    await prisma.artist.deleteMany({ where: { id: { in: [artistAId, artistBId] } } });
    await prisma.city.deleteMany({ where: { id: { in: [cityId, secondCityId] } } });
    await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  function uniqueEmail(label: string) {
    const email = `${label}-${randomUUID()}@example.com`;
    createdUserEmails.push(email);
    return email;
  }

  describe('POST /fan-profiles', () => {
    // Case 1: crear un perfil válido devuelve 201.
    it('returns 201 for a valid payload', async () => {
      const email = uniqueEmail('valid');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Valid Fan', cityId })
        .expect(201);
    });

    // Case 2: crea User y FanProfile.
    it('creates a User and a FanProfile in the database', async () => {
      const email = uniqueEmail('creates');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Creates Fan', cityId })
        .expect(201);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();

      const fanProfile = await prisma.fanProfile.findUnique({
        where: { id: response.body.id },
      });
      expect(fanProfile).not.toBeNull();
      expect(fanProfile?.userId).toBe(user?.id);
      expect(fanProfile?.displayName).toBe('Creates Fan');
      expect(fanProfile?.cityId).toBe(cityId);
    });

    // Case 3: showOnMap por defecto es false.
    it('defaults showOnMap to false when not provided', async () => {
      const email = uniqueEmail('default-show');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Default Show', cityId })
        .expect(201);

      expect(response.body.showOnMap).toBe(false);
    });

    it('respects an explicit showOnMap value', async () => {
      const email = uniqueEmail('explicit-show');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Explicit Show', cityId, showOnMap: true })
        .expect(201);

      expect(response.body.showOnMap).toBe(true);
    });

    // Case 4: no devuelve email ni userId en la respuesta.
    it('does not return email or userId in the response', async () => {
      const email = uniqueEmail('no-leak');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'No Leak', cityId })
        .expect(201);

      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });

    // Case 5: cityId inexistente devuelve 400.
    it('returns 400 when cityId does not reference an existing city', async () => {
      const email = uniqueEmail('missing-city');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Missing City', cityId: randomUUID() })
        .expect(400);
    });

    // Case 6: email duplicado devuelve 409.
    it('returns 409 when the email is already in use', async () => {
      const email = uniqueEmail('duplicate');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'First Fan', cityId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Second Fan', cityId })
        .expect(409);
    });

    // Case 7: displayName inválido devuelve 400.
    it('returns 400 when displayName is empty', async () => {
      const email = uniqueEmail('invalid-name');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: '', cityId })
        .expect(400);
    });

    it('returns 400 when displayName is missing', async () => {
      const email = uniqueEmail('missing-name');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, cityId })
        .expect(400);
    });

    // Case 8: cityId inválido devuelve 400.
    it('returns 400 when cityId is not a valid UUID', async () => {
      const email = uniqueEmail('invalid-city-format');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Invalid City Format', cityId: 'not-a-uuid' })
        .expect(400);
    });

    // Case 9: campos desconocidos son rechazados por ValidationPipe.
    it('returns 400 when the payload includes unknown fields', async () => {
      const email = uniqueEmail('unknown-field');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Unknown Field',
          cityId,
          isAdmin: true,
        })
        .expect(400);
    });

    // Case 10: la respuesta incluye city y country.
    it('includes city and country in the response', async () => {
      const email = uniqueEmail('city-country');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'City Country', cityId })
        .expect(201);

      expect(response.body.city).toEqual({
        id: cityId,
        name: cityName,
        latitude: -32.89,
        longitude: -68.84,
        country: {
          id: countryId,
          name: countryName,
          code: expect.any(String),
        },
      });
    });
  });

  describe('GET /fan-profiles', () => {
    async function createProfile(label: string, showOnMap: boolean) {
      const email = uniqueEmail(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: `${label} Fan`, cityId, showOnMap })
        .expect(201);
      return response.body as { id: string };
    }

    // Caso: sin filtro devuelve todos (incluye los visibles y no visibles).
    it('returns all fan profiles when onMap is not provided', async () => {
      const onMapProfile = await createProfile('list-all-on', true);
      const offMapProfile = await createProfile('list-all-off', false);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles')
        .expect(200);

      const ids: string[] = response.body.map(
        (profile: { id: string }) => profile.id,
      );
      expect(ids).toEqual(expect.arrayContaining([
        onMapProfile.id,
        offMapProfile.id,
      ]));
    });

    // Caso: onMap=true devuelve solamente los visibles en el mapa.
    it('returns only fan profiles with showOnMap=true when onMap=true', async () => {
      const onMapProfile = await createProfile('list-true-on', true);
      const offMapProfile = await createProfile('list-true-off', false);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles?onMap=true')
        .expect(200);

      const ids: string[] = response.body.map(
        (profile: { id: string }) => profile.id,
      );
      expect(ids).toContain(onMapProfile.id);
      expect(ids).not.toContain(offMapProfile.id);
      response.body.forEach((profile: { showOnMap: boolean }) => {
        expect(profile.showOnMap).toBe(true);
      });
    });

    // Caso: onMap=false devuelve solamente los no visibles en el mapa.
    it('returns only fan profiles with showOnMap=false when onMap=false', async () => {
      const onMapProfile = await createProfile('list-false-on', true);
      const offMapProfile = await createProfile('list-false-off', false);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles?onMap=false')
        .expect(200);

      const ids: string[] = response.body.map(
        (profile: { id: string }) => profile.id,
      );
      expect(ids).toContain(offMapProfile.id);
      expect(ids).not.toContain(onMapProfile.id);
      response.body.forEach((profile: { showOnMap: boolean }) => {
        expect(profile.showOnMap).toBe(false);
      });
    });

    // Caso: onMap con valor inválido devuelve 400.
    it('returns 400 when onMap is not a valid boolean', async () => {
      await request(app.getHttpServer())
        .get('/fan-profiles?onMap=foo')
        .expect(400);
    });

    // Caso: la respuesta mantiene el shape de GET /fan-profiles/:id, sin email ni userId.
    it('returns the same shape as GET /:id, without email or userId', async () => {
      const profile = await createProfile('list-shape', true);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles?onMap=true')
        .expect(200);

      const found = response.body.find(
        (item: { id: string }) => item.id === profile.id,
      );
      expect(found).toEqual({
        id: profile.id,
        displayName: 'list-shape Fan',
        showOnMap: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        city: {
          id: cityId,
          name: cityName,
          latitude: -32.89,
          longitude: -68.84,
          country: {
            id: countryId,
            name: countryName,
            code: expect.any(String),
          },
        },
        artists: [],
      });
      expect(found).not.toHaveProperty('email');
      expect(found).not.toHaveProperty('userId');
    });
  });

  describe('GET /fan-profiles?onMap=true coordinate filtering', () => {
    async function createProfileInCity(
      label: string,
      showOnMap: boolean,
      city: string,
    ) {
      const email = uniqueEmail(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: `${label} Fan`, cityId: city, showOnMap })
        .expect(201);
      return response.body as { id: string };
    }

    // Fan A: visible + ciudad con coordenadas → debe aparecer con onMap=true.
    // Fan B: visible + ciudad sin coordenadas → NO debe aparecer con onMap=true.
    // Fan C: no visible + ciudad con coordenadas → NO debe aparecer con onMap=true.
    it('returns only the profile that is visible and has city coordinates', async () => {
      const fanA = await createProfileInCity('coord-fan-a', true, cityId);
      const fanB = await createProfileInCity('coord-fan-b', true, secondCityId);
      const fanC = await createProfileInCity('coord-fan-c', false, cityId);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles?onMap=true')
        .expect(200);

      const ids: string[] = response.body.map(
        (profile: { id: string }) => profile.id,
      );
      expect(ids).toContain(fanA.id);
      expect(ids).not.toContain(fanB.id);
      expect(ids).not.toContain(fanC.id);
    });

    // GET /fan-profiles (sin filtro) sigue devolviendo los tres perfiles,
    // sin aplicar el filtro de coordenadas.
    it('returns all three profiles when onMap is not provided', async () => {
      const fanA = await createProfileInCity('coord-all-a', true, cityId);
      const fanB = await createProfileInCity('coord-all-b', true, secondCityId);
      const fanC = await createProfileInCity('coord-all-c', false, cityId);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles')
        .expect(200);

      const ids: string[] = response.body.map(
        (profile: { id: string }) => profile.id,
      );
      expect(ids).toEqual(
        expect.arrayContaining([fanA.id, fanB.id, fanC.id]),
      );
    });

    // GET /fan-profiles?onMap=false sigue funcionando como antes: solo filtra
    // por showOnMap=false, sin importar las coordenadas de la ciudad.
    it('returns only the non-visible profile when onMap=false, regardless of coordinates', async () => {
      const fanA = await createProfileInCity('coord-off-a', true, cityId);
      const fanB = await createProfileInCity('coord-off-b', true, secondCityId);
      const fanC = await createProfileInCity('coord-off-c', false, cityId);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles?onMap=false')
        .expect(200);

      const ids: string[] = response.body.map(
        (profile: { id: string }) => profile.id,
      );
      expect(ids).toContain(fanC.id);
      expect(ids).not.toContain(fanA.id);
      expect(ids).not.toContain(fanB.id);
    });
  });

  describe('GET /fan-profiles/:id', () => {
    // Caso exitoso: devuelve 200 con los campos esperados, sin email ni userId.
    it('returns 200 with the fan profile, without email or userId', async () => {
      const email = uniqueEmail('get-success');

      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'Get Success', cityId })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${created.body.id}`)
        .expect(200);

      expect(response.body).toEqual({
        id: created.body.id,
        displayName: 'Get Success',
        showOnMap: false,
        createdAt: created.body.createdAt,
        updatedAt: created.body.updatedAt,
        city: {
          id: cityId,
          name: cityName,
          latitude: -32.89,
          longitude: -68.84,
          country: {
            id: countryId,
            name: countryName,
            code: expect.any(String),
          },
        },
        artists: [],
      });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });

    // Caso: UUID con formato inválido devuelve 400.
    it('returns 400 when the id is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/fan-profiles/not-a-uuid')
        .expect(400);
    });

    // Caso: FanProfile inexistente devuelve 404.
    it('returns 404 when the fan profile does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/fan-profiles/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('PATCH /fan-profiles/:id', () => {
    async function createProfile(label: string) {
      const email = uniqueEmail(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: `${label} Fan`, cityId })
        .expect(201);
      return response.body as { id: string };
    }

    // Caso 1: PATCH válido devuelve 200.
    it('returns 200 for a valid payload', async () => {
      const profile = await createProfile('patch-valid');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ displayName: 'Updated Name' })
        .expect(200);
    });

    // Caso 2: actualiza solamente los campos enviados.
    it('updates only the fields sent, leaving the rest unchanged', async () => {
      const profile = await createProfile('patch-partial');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ showOnMap: true })
        .expect(200);

      expect(response.body.showOnMap).toBe(true);
      expect(response.body.displayName).toBe('patch-partial Fan');
      expect(response.body.city.id).toBe(cityId);
    });

    // Caso 3: puede actualizar displayName.
    it('updates displayName', async () => {
      const profile = await createProfile('patch-name');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ displayName: 'Renamed Fan' })
        .expect(200);

      expect(response.body.displayName).toBe('Renamed Fan');
    });

    // Caso 4: puede actualizar cityId.
    it('updates cityId', async () => {
      const profile = await createProfile('patch-city');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ cityId: secondCityId })
        .expect(200);

      expect(response.body.city).toEqual({
        id: secondCityId,
        name: secondCityName,
        latitude: null,
        longitude: null,
        country: {
          id: countryId,
          name: countryName,
          code: expect.any(String),
        },
      });
    });

    // Caso 5: puede actualizar showOnMap.
    it('updates showOnMap', async () => {
      const profile = await createProfile('patch-show');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ showOnMap: true })
        .expect(200);

      expect(response.body.showOnMap).toBe(true);
    });

    // Caso 6: cityId inexistente devuelve 400.
    it('returns 400 when cityId does not reference an existing city', async () => {
      const profile = await createProfile('patch-missing-city');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ cityId: randomUUID() })
        .expect(400);
    });

    // Caso 7: FanProfile inexistente devuelve 404.
    it('returns 404 when the fan profile does not exist', async () => {
      await request(app.getHttpServer())
        .patch(`/fan-profiles/${randomUUID()}`)
        .send({ displayName: 'Nobody' })
        .expect(404);
    });

    // Caso 8: UUID inválido en :id devuelve 400.
    it('returns 400 when the id is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .patch('/fan-profiles/not-a-uuid')
        .send({ displayName: 'Nobody' })
        .expect(400);
    });

    // Caso 9: no permite modificar email.
    it('returns 400 when trying to modify email', async () => {
      const profile = await createProfile('patch-no-email');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ email: 'new-email@example.com' })
        .expect(400);
    });

    // Caso 10: no permite modificar userId.
    it('returns 400 when trying to modify userId', async () => {
      const profile = await createProfile('patch-no-userid');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ userId: randomUUID() })
        .expect(400);
    });

    // Caso 11: no permite campos desconocidos.
    it('returns 400 when the payload includes unknown fields', async () => {
      const profile = await createProfile('patch-unknown');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ isAdmin: true })
        .expect(400);
    });

    // Caso 12 & 13: la respuesta mantiene el shape de GET, sin email ni userId.
    it('returns the same shape as GET, without email or userId', async () => {
      const profile = await createProfile('patch-shape');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ displayName: 'Shape Fan' })
        .expect(200);

      expect(response.body).toEqual({
        id: profile.id,
        displayName: 'Shape Fan',
        showOnMap: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        city: {
          id: cityId,
          name: cityName,
          latitude: -32.89,
          longitude: -68.84,
          country: {
            id: countryId,
            name: countryName,
            code: expect.any(String),
          },
        },
        artists: [],
      });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });
  });

  describe('POST /fan-profiles with artistIds', () => {
    // Requisito: crea FanProfile + FanArtist de forma atómica.
    it('creates FanArtist rows for the given artistIds', async () => {
      const email = uniqueEmail('artists-create');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Artists Fan',
          cityId,
          artistIds: [artistAId, artistBId],
        })
        .expect(201);

      const fanArtists = await prisma.fanArtist.findMany({
        where: { fanProfileId: response.body.id },
      });
      expect(fanArtists.map((fa) => fa.artistId).sort()).toEqual(
        [artistAId, artistBId].sort(),
      );
    });

    it('includes the artists in the response, ordered by name', async () => {
      const email = uniqueEmail('artists-response');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Artists Response Fan',
          cityId,
          artistIds: [artistBId, artistAId],
        })
        .expect(201);

      expect(response.body.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
        { id: artistBId, name: artistBName, slug: artistBSlug, imageUrl: null },
      ]);
    });

    it('creates a profile with an empty artists array when artistIds is not sent', async () => {
      const email = uniqueEmail('artists-none');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: 'No Artists Fan', cityId })
        .expect(201);

      expect(response.body.artists).toEqual([]);
    });

    it('deduplicates repeated artistIds without erroring', async () => {
      const email = uniqueEmail('artists-dedupe');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Dedupe Fan',
          cityId,
          artistIds: [artistAId, artistAId],
        })
        .expect(201);

      expect(response.body.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
      ]);
    });

    // Requisito: valida que todos los artistas existan.
    it('returns 400 when an artistId does not reference an existing artist', async () => {
      const email = uniqueEmail('artists-missing');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Missing Artist Fan',
          cityId,
          artistIds: [artistAId, randomUUID()],
        })
        .expect(400);
    });

    // Requisito: creación atómica — si un artistId no existe, no debe crearse
    // ni el User ni el FanProfile.
    it('creates neither the User nor the FanProfile when an artistId is invalid', async () => {
      const email = uniqueEmail('artists-atomic');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Atomic Fan',
          cityId,
          artistIds: [randomUUID()],
        })
        .expect(400);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    });

    it('returns 400 when artistIds contains a value that is not a valid UUID', async () => {
      const email = uniqueEmail('artists-invalid-uuid');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Invalid UUID Fan',
          cityId,
          artistIds: ['not-a-uuid'],
        })
        .expect(400);
    });

    it('returns 400 when artistIds is not an array', async () => {
      const email = uniqueEmail('artists-not-array');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Not Array Fan',
          cityId,
          artistIds: artistAId,
        })
        .expect(400);
    });
  });

  describe('GET /fan-profiles(/:id) with artists', () => {
    it('GET /fan-profiles/:id includes the artists the fan follows', async () => {
      const email = uniqueEmail('get-artists');
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'Get Artists Fan',
          cityId,
          artistIds: [artistAId],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${created.body.id}`)
        .expect(200);

      expect(response.body.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
      ]);
    });

    it('GET /fan-profiles includes the artists for each fan in the list', async () => {
      const email = uniqueEmail('list-artists');
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({
          email,
          displayName: 'List Artists Fan',
          cityId,
          artistIds: [artistAId, artistBId],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles')
        .expect(200);

      const found = response.body.find(
        (profile: { id: string }) => profile.id === created.body.id,
      );
      expect(found.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
        { id: artistBId, name: artistBName, slug: artistBSlug, imageUrl: null },
      ]);
    });
  });

  describe('PATCH /fan-profiles/:id with artistIds', () => {
    async function createProfileWithArtists(label: string, artistIds: string[]) {
      const email = uniqueEmail(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ email, displayName: `${label} Fan`, cityId, artistIds })
        .expect(201);
      return response.body as { id: string };
    }

    it('replaces the artists a fan follows', async () => {
      const profile = await createProfileWithArtists('patch-artists-replace', [
        artistAId,
      ]);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ artistIds: [artistBId] })
        .expect(200);

      expect(response.body.artists).toEqual([
        { id: artistBId, name: artistBName, slug: artistBSlug, imageUrl: null },
      ]);

      const fanArtists = await prisma.fanArtist.findMany({
        where: { fanProfileId: profile.id },
      });
      expect(fanArtists.map((fa) => fa.artistId)).toEqual([artistBId]);
    });

    it('clears all artists when artistIds is an empty array', async () => {
      const profile = await createProfileWithArtists('patch-artists-clear', [
        artistAId,
        artistBId,
      ]);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ artistIds: [] })
        .expect(200);

      expect(response.body.artists).toEqual([]);
    });

    it('leaves existing artists untouched when artistIds is not sent', async () => {
      const profile = await createProfileWithArtists('patch-artists-untouched', [
        artistAId,
      ]);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ displayName: 'Renamed Untouched Fan' })
        .expect(200);

      expect(response.body.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
      ]);
    });

    // Requisito: reemplazo atómico — si un artistId no existe, no debe
    // tocarse la asociación existente.
    it('returns 400 and keeps the existing artists when an artistId is invalid', async () => {
      const profile = await createProfileWithArtists('patch-artists-invalid', [
        artistAId,
      ]);

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ artistIds: [randomUUID()] })
        .expect(400);

      const fanArtists = await prisma.fanArtist.findMany({
        where: { fanProfileId: profile.id },
      });
      expect(fanArtists.map((fa) => fa.artistId)).toEqual([artistAId]);
    });

    it('deduplicates repeated artistIds without erroring', async () => {
      const profile = await createProfileWithArtists('patch-artists-dedupe', []);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .send({ artistIds: [artistAId, artistAId] })
        .expect(200);

      expect(response.body.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
      ]);
    });
  });
});
