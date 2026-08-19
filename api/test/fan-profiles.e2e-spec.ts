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

  let countryId: string;
  let cityId: string;
  let secondCityId: string;

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
      data: { name: cityName, countryId },
    });
    cityId = city.id;

    const secondCity = await prisma.city.create({
      data: { name: secondCityName, countryId },
    });
    secondCityId = secondCity.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: createdUserEmails } },
      select: { id: true },
    });
    await prisma.fanProfile.deleteMany({
      where: { userId: { in: users.map((user) => user.id) } },
    });
    await prisma.user.deleteMany({ where: { email: { in: createdUserEmails } } });
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
        country: {
          id: countryId,
          name: countryName,
          code: expect.any(String),
        },
      });
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
          country: {
            id: countryId,
            name: countryName,
            code: expect.any(String),
          },
        },
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
          country: {
            id: countryId,
            name: countryName,
            code: expect.any(String),
          },
        },
      });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });
  });
});
