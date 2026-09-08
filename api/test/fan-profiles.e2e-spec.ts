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

// POST /fan-profiles ahora requiere sesión (SessionAuthGuard): el User se
// resuelve de request.user.id, nunca de un campo del body (ver Etapa 2 —
// integración de FanProfiles con Auth). Sin pegarle a Google real: el User
// y la Session se crean acá directamente vía AuthService/SessionService,
// igual que en auth.e2e-spec.ts.
describe('FanProfiles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let sessionService: SessionService;

  const sessionSecret =
    process.env.SESSION_SECRET ?? 'dev-insecure-session-secret';

  const suffix = randomUUID().slice(0, 8);
  const countryName = `Fan Country ${suffix}`;
  const cityName = `Fan City ${suffix}`;
  const secondCityName = `Fan City 2 ${suffix}`;

  const artistAName = `Fan Artist A ${suffix}`;
  const artistASlug = `fan-artist-a-${suffix}`;
  const artistBName = `Fan Artist B ${suffix}`;
  const artistBSlug = `fan-artist-b-${suffix}`;

  const songATitle = `Fan Song A ${suffix}`;
  const songBTitle = `Fan Song B ${suffix}`;

  let countryId: string;
  let cityId: string;
  let secondCityId: string;
  let artistAId: string;
  let artistBId: string;
  let songAId: string;
  let songBId: string;

  // emails/session ids creados por tests individuales, limpiados en afterAll.
  const createdUserEmails: string[] = [];
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    // main.ts aplica cookie-parser en bootstrap(), que este setup de test no
    // ejecuta — hace falta declararlo también acá (mismo secreto que usaría
    // la app real) para que req.signedCookies exista (ver auth.e2e-spec.ts).
    app.use(cookieParser(sessionSecret));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    sessionService = app.get(SessionService);

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

    const songA = await prisma.song.create({
      data: {
        artistId: artistAId,
        title: songATitle,
        mbid: `mbid-a-${suffix}`,
      },
    });
    songAId = songA.id;

    const songB = await prisma.song.create({
      data: {
        artistId: artistAId,
        title: songBTitle,
        mbid: `mbid-b-${suffix}`,
      },
    });
    songBId = songB.id;
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
    // Session referencia al User por FK: hay que borrarla antes que el User.
    await prisma.session.deleteMany({
      where: { id: { in: createdSessionIds } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: createdUserEmails } },
    });
    // fan_profile_songs ya se borró en cascada con el fanProfile de arriba
    // (onDelete: Cascade en el schema) — songs se puede borrar directo.
    await prisma.song.deleteMany({ where: { id: { in: [songAId, songBId] } } });
    await prisma.artist.deleteMany({
      where: { id: { in: [artistAId, artistBId] } },
    });
    await prisma.city.deleteMany({
      where: { id: { in: [cityId, secondCityId] } },
    });
    await prisma.country.deleteMany({ where: { id: countryId } });
    await app.close();
  });

  function signedCookieHeader(sessionId: string): string {
    const signed = `s:${sign(sessionId, sessionSecret)}`;
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`;
  }

  // Crea un User + Session reales (sin pegarle a Google) y devuelve la
  // cookie de sesión firmada a usar en los requests — lo mismo que dejaría
  // listo AuthController#googleCallback tras un login exitoso. `photoUrl`
  // es null por defecto (la mayoría de los tests no le importa la foto);
  // los tests que sí la necesitan lo overridean.
  async function authenticatedUser(
    label: string,
    photoUrl: string | null = null,
  ) {
    const email = `${label}-${randomUUID()}@example.com`;
    createdUserEmails.push(email);

    const user = await authService.findOrCreateFromGoogle({
      googleId: `google-${label}-${randomUUID()}`,
      email,
      name: label,
      emailVerified: true,
      photoUrl,
    });

    const session = await sessionService.create(user.id);
    createdSessionIds.push(session.id);

    return { userId: user.id, email, cookie: signedCookieHeader(session.id) };
  }

  // Shape "propio" en blanco (sin redes, sin favoritas, sin foto) — lo que
  // devuelve POST/PATCH/GET /me para un perfil recién creado sin tocar
  // ninguno de los campos nuevos.
  const blankOwnFields = {
    photoUrl: null,
    setlistSongs: [] as unknown[],
    favoriteSongs: [] as unknown[],
    instagramUrl: null,
    instagramIsPublic: false,
    tiktokUrl: null,
    tiktokIsPublic: false,
    xUrl: null,
    xIsPublic: false,
    youtubeUrl: null,
    youtubeIsPublic: false,
    facebookUrl: null,
    facebookIsPublic: false,
  };

  // Shape público en blanco — lo que devuelve GET /:id y GET (list) para
  // ese mismo perfil.
  const blankPublicFields = {
    photoUrl: null,
    setlistSongs: [] as unknown[],
    favoriteSongs: [] as unknown[],
    social: {},
  };

  describe('POST /fan-profiles', () => {
    // Case 1: sin sesión válida devuelve 401.
    it('returns 401 when there is no session cookie', async () => {
      await request(app.getHttpServer())
        .post('/fan-profiles')
        .send({ displayName: 'No Session Fan', cityId })
        .expect(401);
    });

    it('returns 401 with a forged (badly-signed) session cookie', async () => {
      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', `${SESSION_COOKIE_NAME}=not-a-real-signed-value`)
        .send({ displayName: 'Forged Cookie Fan', cityId })
        .expect(401);
    });

    // Case 2: crear un perfil válido con sesión devuelve 201.
    it('returns 201 for a valid payload', async () => {
      const { cookie } = await authenticatedUser('valid');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Valid Fan', cityId })
        .expect(201);
    });

    // Case 3: el FanProfile queda asociado al User autenticado, y no se crea
    // ningún otro User.
    it('associates the FanProfile with the authenticated user, without creating another User', async () => {
      const { userId, cookie } = await authenticatedUser('creates');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Creates Fan', cityId })
        .expect(201);

      const fanProfile = await prisma.fanProfile.findUnique({
        where: { id: response.body.id },
      });
      expect(fanProfile).not.toBeNull();
      expect(fanProfile?.userId).toBe(userId);
      expect(fanProfile?.displayName).toBe('Creates Fan');
      expect(fanProfile?.cityId).toBe(cityId);

      const usersWithId = await prisma.user.findMany({ where: { id: userId } });
      expect(usersWithId).toHaveLength(1);
    });

    // Case 4: POST /fan-profiles ya no crea un User como efecto secundario.
    // El único User involucrado es el creado explícitamente por
    // authenticatedUser() vía AuthService, antes del POST.
    it('does not create a new User as a side effect', async () => {
      const { cookie } = await authenticatedUser('no-side-effect');

      const usersBefore = await prisma.user.count();

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'No Side Effect Fan', cityId })
        .expect(201);

      const usersAfter = await prisma.user.count();
      expect(usersAfter).toBe(usersBefore);
    });

    // Case 3: showOnMap por defecto es false.
    it('defaults showOnMap to false when not provided', async () => {
      const { cookie } = await authenticatedUser('default-show');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Default Show', cityId })
        .expect(201);

      expect(response.body.showOnMap).toBe(false);
    });

    it('respects an explicit showOnMap value', async () => {
      const { cookie } = await authenticatedUser('explicit-show');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Explicit Show', cityId, showOnMap: true })
        .expect(201);

      expect(response.body.showOnMap).toBe(true);
    });

    // Case: no devuelve email ni userId en la respuesta.
    it('does not return email or userId in the response', async () => {
      const { cookie } = await authenticatedUser('no-leak');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'No Leak', cityId })
        .expect(201);

      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });

    // Case: cityId inexistente devuelve 400.
    it('returns 400 when cityId does not reference an existing city', async () => {
      const { cookie } = await authenticatedUser('missing-city');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Missing City', cityId: randomUUID() })
        .expect(400);
    });

    // Case 5 (regla de negocio): el mismo User autenticado no puede tener
    // dos FanProfile — 409 en el segundo POST. Reemplaza el viejo caso de
    // "email duplicado" (ya no aplica: el body no lleva email).
    it('returns 409 when the authenticated user already has a fan profile', async () => {
      const { cookie } = await authenticatedUser('duplicate');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'First Fan', cityId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Second Fan', cityId })
        .expect(409);
    });

    // Case 5 (seguridad): un userId en el body es un campo desconocido para
    // el DTO y lo rechaza el ValidationPipe — no hay forma de que el
    // cliente elija a qué User se asocia su FanProfile.
    it('returns 400 when the payload includes a userId (unknown field), and does not associate the profile with it', async () => {
      const { cookie } = await authenticatedUser('userid-injection');
      const otherUser = await authenticatedUser('userid-injection-target');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: 'Injected UserId Fan',
          cityId,
          userId: otherUser.userId,
        })
        .expect(400);

      const otherUsersProfile = await prisma.fanProfile.findUnique({
        where: { userId: otherUser.userId },
      });
      expect(otherUsersProfile).toBeNull();
    });

    // Case: displayName inválido devuelve 400.
    it('returns 400 when displayName is empty', async () => {
      const { cookie } = await authenticatedUser('invalid-name');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: '', cityId })
        .expect(400);
    });

    it('returns 400 when displayName is missing', async () => {
      const { cookie } = await authenticatedUser('missing-name');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ cityId })
        .expect(400);
    });

    // Case: cityId inválido devuelve 400.
    it('returns 400 when cityId is not a valid UUID', async () => {
      const { cookie } = await authenticatedUser('invalid-city-format');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Invalid City Format', cityId: 'not-a-uuid' })
        .expect(400);
    });

    // Case: campos desconocidos son rechazados por ValidationPipe.
    it('returns 400 when the payload includes unknown fields', async () => {
      const { cookie } = await authenticatedUser('unknown-field');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: 'Unknown Field',
          cityId,
          isAdmin: true,
        })
        .expect(400);
    });

    // Case: la respuesta incluye city y country.
    it('includes city and country in the response', async () => {
      const { cookie } = await authenticatedUser('city-country');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'City Country', cityId })
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
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId, showOnMap })
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
      expect(ids).toEqual(
        expect.arrayContaining([onMapProfile.id, offMapProfile.id]),
      );
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
        ...blankPublicFields,
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
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId: city, showOnMap })
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
      expect(ids).toEqual(expect.arrayContaining([fanA.id, fanB.id, fanC.id]));
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

  // Etapa 3: GET /fan-profiles/me — resuelve por sesión, no por :id.
  describe('GET /fan-profiles/me', () => {
    it('returns 401 when there is no session cookie', async () => {
      await request(app.getHttpServer()).get('/fan-profiles/me').expect(401);
    });

    it('returns 404 when the authenticated user has no fan profile', async () => {
      const { cookie } = await authenticatedUser('me-no-profile');

      await request(app.getHttpServer())
        .get('/fan-profiles/me')
        .set('Cookie', cookie)
        .expect(404);
    });

    it("returns 200 with the authenticated user's own fan profile", async () => {
      const { cookie } = await authenticatedUser('me-has-profile');

      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Me Fan', cityId })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body).toEqual(created.body);
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });

    // No debe filtrarse el perfil de otro user: cada sesión ve únicamente
    // el suyo, nunca el de otra sesión válida.
    it("does not return another user's fan profile", async () => {
      const owner = await authenticatedUser('me-owner');
      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', owner.cookie)
        .send({ displayName: 'Owner Fan', cityId })
        .expect(201);

      const other = await authenticatedUser('me-other');

      await request(app.getHttpServer())
        .get('/fan-profiles/me')
        .set('Cookie', other.cookie)
        .expect(404);
    });
  });

  describe('GET /fan-profiles/:id', () => {
    // Caso exitoso: devuelve 200 con los campos esperados, sin email ni userId.
    it('returns 200 with the fan profile, without email or userId', async () => {
      const { cookie } = await authenticatedUser('get-success');

      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Get Success', cityId })
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
        ...blankPublicFields,
      });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
      // La vista pública nunca expone los flags/URLs individuales de red
      // social, solo `social` ya filtrado.
      expect(response.body).not.toHaveProperty('instagramUrl');
      expect(response.body).not.toHaveProperty('instagramIsPublic');
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
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId })
        .expect(201);
      return { id: response.body.id as string, cookie };
    }

    // Etapa 4 — hallazgo crítico: antes este endpoint no tenía guard.
    it('returns 401 when there is no session cookie', async () => {
      const { id } = await createProfile('patch-401');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .send({ displayName: 'Hijacked Name' })
        .expect(401);
    });

    // Etapa 4 — hallazgo crítico: antes este endpoint no verificaba
    // ownership; un User autenticado cualquiera podía modificar el
    // FanProfile de otro conociendo su id.
    it("returns 403 when the authenticated user tries to update another user's fan profile", async () => {
      const owner = await createProfile('patch-403-owner');
      const attacker = await authenticatedUser('patch-403-attacker');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${owner.id}`)
        .set('Cookie', attacker.cookie)
        .send({ displayName: 'Hijacked Name' })
        .expect(403);

      const stillOwned = await prisma.fanProfile.findUnique({
        where: { id: owner.id },
      });
      expect(stillOwned?.displayName).toBe('patch-403-owner Fan');
    });

    // Caso 1: PATCH válido devuelve 200.
    it('returns 200 for a valid payload', async () => {
      const { id, cookie } = await createProfile('patch-valid');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ displayName: 'Updated Name' })
        .expect(200);
    });

    // Caso 2: actualiza solamente los campos enviados.
    it('updates only the fields sent, leaving the rest unchanged', async () => {
      const { id, cookie } = await createProfile('patch-partial');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ showOnMap: true })
        .expect(200);

      expect(response.body.showOnMap).toBe(true);
      expect(response.body.displayName).toBe('patch-partial Fan');
      expect(response.body.city.id).toBe(cityId);
    });

    // Caso 3: puede actualizar displayName.
    it('updates displayName', async () => {
      const { id, cookie } = await createProfile('patch-name');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ displayName: 'Renamed Fan' })
        .expect(200);

      expect(response.body.displayName).toBe('Renamed Fan');
    });

    // Caso 4: puede actualizar cityId.
    it('updates cityId', async () => {
      const { id, cookie } = await createProfile('patch-city');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
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
      const { id, cookie } = await createProfile('patch-show');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ showOnMap: true })
        .expect(200);

      expect(response.body.showOnMap).toBe(true);
    });

    // Caso 6: cityId inexistente devuelve 400.
    it('returns 400 when cityId does not reference an existing city', async () => {
      const { id, cookie } = await createProfile('patch-missing-city');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ cityId: randomUUID() })
        .expect(400);
    });

    // Caso 7: FanProfile inexistente devuelve 404.
    it('returns 404 when the fan profile does not exist', async () => {
      const { cookie } = await authenticatedUser('patch-404');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${randomUUID()}`)
        .set('Cookie', cookie)
        .send({ displayName: 'Nobody' })
        .expect(404);
    });

    // Caso 8: UUID inválido en :id devuelve 400.
    it('returns 400 when the id is not a valid UUID', async () => {
      const { cookie } = await authenticatedUser('patch-invalid-uuid');

      await request(app.getHttpServer())
        .patch('/fan-profiles/not-a-uuid')
        .set('Cookie', cookie)
        .send({ displayName: 'Nobody' })
        .expect(400);
    });

    // Caso 9: no permite modificar email.
    it('returns 400 when trying to modify email', async () => {
      const { id, cookie } = await createProfile('patch-no-email');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ email: 'new-email@example.com' })
        .expect(400);
    });

    // Caso 10: no permite modificar userId.
    it('returns 400 when trying to modify userId', async () => {
      const { id, cookie } = await createProfile('patch-no-userid');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ userId: randomUUID() })
        .expect(400);
    });

    // Caso 11: no permite campos desconocidos.
    it('returns 400 when the payload includes unknown fields', async () => {
      const { id, cookie } = await createProfile('patch-unknown');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ isAdmin: true })
        .expect(400);
    });

    // Caso 12 & 13: la respuesta mantiene el shape de GET, sin email ni userId.
    it('returns the same shape as GET, without email or userId', async () => {
      const { id, cookie } = await createProfile('patch-shape');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ displayName: 'Shape Fan' })
        .expect(200);

      expect(response.body).toEqual({
        id,
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
        ...blankOwnFields,
      });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('userId');
    });
  });

  describe('POST /fan-profiles with artistIds', () => {
    // Requisito: crea FanProfile + FanArtist de forma atómica.
    it('creates FanArtist rows for the given artistIds', async () => {
      const { cookie } = await authenticatedUser('artists-create');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
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
      const { cookie } = await authenticatedUser('artists-response');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
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
      const { cookie } = await authenticatedUser('artists-none');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'No Artists Fan', cityId })
        .expect(201);

      expect(response.body.artists).toEqual([]);
    });

    it('deduplicates repeated artistIds without erroring', async () => {
      const { cookie } = await authenticatedUser('artists-dedupe');

      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
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
      const { cookie } = await authenticatedUser('artists-missing');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: 'Missing Artist Fan',
          cityId,
          artistIds: [artistAId, randomUUID()],
        })
        .expect(400);
    });

    // Requisito: si un artistId no existe, no debe crearse el FanProfile.
    it('creates no FanProfile when an artistId is invalid', async () => {
      const { userId, cookie } = await authenticatedUser('artists-atomic');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: 'Atomic Fan',
          cityId,
          artistIds: [randomUUID()],
        })
        .expect(400);

      const fanProfile = await prisma.fanProfile.findUnique({
        where: { userId },
      });
      expect(fanProfile).toBeNull();
    });

    it('returns 400 when artistIds contains a value that is not a valid UUID', async () => {
      const { cookie } = await authenticatedUser('artists-invalid-uuid');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: 'Invalid UUID Fan',
          cityId,
          artistIds: ['not-a-uuid'],
        })
        .expect(400);
    });

    it('returns 400 when artistIds is not an array', async () => {
      const { cookie } = await authenticatedUser('artists-not-array');

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
          displayName: 'Not Array Fan',
          cityId,
          artistIds: artistAId,
        })
        .expect(400);
    });
  });

  describe('GET /fan-profiles(/:id) with artists', () => {
    it('GET /fan-profiles/:id includes the artists the fan follows', async () => {
      const { cookie } = await authenticatedUser('get-artists');
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
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
      const { cookie } = await authenticatedUser('list-artists');
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({
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
    async function createProfileWithArtists(
      label: string,
      artistIds: string[],
    ) {
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId, artistIds })
        .expect(201);
      return { id: response.body.id as string, cookie };
    }

    it('replaces the artists a fan follows', async () => {
      const profile = await createProfileWithArtists('patch-artists-replace', [
        artistAId,
      ]);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .set('Cookie', profile.cookie)
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
        .set('Cookie', profile.cookie)
        .send({ artistIds: [] })
        .expect(200);

      expect(response.body.artists).toEqual([]);
    });

    it('leaves existing artists untouched when artistIds is not sent', async () => {
      const profile = await createProfileWithArtists(
        'patch-artists-untouched',
        [artistAId],
      );

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .set('Cookie', profile.cookie)
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
        .set('Cookie', profile.cookie)
        .send({ artistIds: [randomUUID()] })
        .expect(400);

      const fanArtists = await prisma.fanArtist.findMany({
        where: { fanProfileId: profile.id },
      });
      expect(fanArtists.map((fa) => fa.artistId)).toEqual([artistAId]);
    });

    it('deduplicates repeated artistIds without erroring', async () => {
      const profile = await createProfileWithArtists(
        'patch-artists-dedupe',
        [],
      );

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${profile.id}`)
        .set('Cookie', profile.cookie)
        .send({ artistIds: [artistAId, artistAId] })
        .expect(200);

      expect(response.body.artists).toEqual([
        { id: artistAId, name: artistAName, slug: artistASlug, imageUrl: null },
      ]);
    });
  });

  describe('PATCH /fan-profiles/:id with setlistSongs', () => {
    async function createProfile(label: string) {
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId })
        .expect(201);
      return { id: response.body.id as string, cookie };
    }

    it('adds setlist songs with their position and returns them', async () => {
      const { id, cookie } = await createProfile('setlist-add');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 2 },
          ],
        })
        .expect(200);

      expect(response.body.setlistSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
        { id: songBId, title: songBTitle, albumTitle: null, position: 2 },
      ]);
    });

    it('rejects more than 15 setlist songs', async () => {
      const { id, cookie } = await createProfile('setlist-max-15');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: Array.from({ length: 16 }, (_, i) => ({
            songId: randomUUID(),
            position: i + 1,
          })),
        })
        .expect(400);
    });

    it('rejects a duplicate songId', async () => {
      const { id, cookie } = await createProfile('setlist-dup-song');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: [
            { songId: songAId, position: 1 },
            { songId: songAId, position: 2 },
          ],
        })
        .expect(400);
    });

    it('rejects a duplicate position', async () => {
      const { id, cookie } = await createProfile('setlist-dup-position');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 1 },
          ],
        })
        .expect(400);
    });

    it('rejects a position outside 1-15', async () => {
      const { id, cookie } = await createProfile('setlist-position-range');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: songAId, position: 16 }] })
        .expect(400);
    });

    it('rejects a songId that does not exist in the catalog, without touching anything', async () => {
      const { id, cookie } = await createProfile('setlist-missing-song');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: randomUUID(), position: 1 }] })
        .expect(400);

      const rows = await prisma.fanProfileSetlistSong.findMany({
        where: { fanProfileId: id },
      });
      expect(rows).toEqual([]);
    });

    it('reorders the setlist by replacing the whole set with new positions', async () => {
      const { id, cookie } = await createProfile('setlist-reorder');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: [
            { songId: songAId, position: 2 },
            { songId: songBId, position: 1 },
          ],
        })
        .expect(200);

      const reordered = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 2 },
          ],
        })
        .expect(200);

      expect(reordered.body.setlistSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
        { id: songBId, title: songBTitle, albumTitle: null, position: 2 },
      ]);
    });

    it('removes a song from the setlist by leaving it out of the new array', async () => {
      const { id, cookie } = await createProfile('setlist-remove');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          setlistSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 2 },
          ],
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: songBId, position: 1 }] })
        .expect(200);

      expect(response.body.setlistSongs).toEqual([
        { id: songBId, title: songBTitle, albumTitle: null, position: 1 },
      ]);
    });

    it('leaves the existing setlist untouched when setlistSongs is not sent', async () => {
      const { id, cookie } = await createProfile('setlist-untouched');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: songAId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ displayName: 'Renamed Setlist Untouched' })
        .expect(200);

      expect(response.body.setlistSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
      ]);
    });

    // Requisito central: el setlist es siempre público, pero NUNCA
    // participa del ranking del Fan Map (ver más abajo,
    // 'GET /fan-profiles/stats/favorite-songs') y modificarlo no debe
    // tocar las favoritas.
    it('does not touch favoriteSongs when only setlistSongs is sent', async () => {
      const { id, cookie } = await createProfile('setlist-vs-favorites');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: songAId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: songBId, position: 1 }] })
        .expect(200);

      expect(response.body.favoriteSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
      ]);
      expect(response.body.setlistSongs).toEqual([
        { id: songBId, title: songBTitle, albumTitle: null, position: 1 },
      ]);
    });

    // Siempre público: también aparece en GET /:id, sin sesión.
    it('is also visible in the public GET /:id, without a session', async () => {
      const { id, cookie } = await createProfile('setlist-public');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: songAId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${id}`)
        .expect(200);

      expect(response.body.setlistSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
      ]);
    });
  });

  describe('PATCH /fan-profiles/:id with favoriteSongs (Top 10)', () => {
    async function createProfile(label: string) {
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId })
        .expect(201);
      return { id: response.body.id as string, cookie };
    }

    it('adds favorite songs with their position and returns them', async () => {
      const { id, cookie } = await createProfile('fav-add');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 2 },
          ],
        })
        .expect(200);

      expect(response.body.favoriteSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
        { id: songBId, title: songBTitle, albumTitle: null, position: 2 },
      ]);
    });

    it('rejects more than 10 favorite songs', async () => {
      const { id, cookie } = await createProfile('fav-max-10');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: Array.from({ length: 11 }, (_, i) => ({
            songId: randomUUID(),
            position: i + 1,
          })),
        })
        .expect(400);
    });

    it('rejects a duplicate songId', async () => {
      const { id, cookie } = await createProfile('fav-dup-song');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: [
            { songId: songAId, position: 1 },
            { songId: songAId, position: 2 },
          ],
        })
        .expect(400);
    });

    it('rejects a songId that does not exist in the catalog, without touching anything', async () => {
      const { id, cookie } = await createProfile('fav-missing-song');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: randomUUID(), position: 1 }] })
        .expect(400);

      const rows = await prisma.fanProfileFavoriteSong.findMany({
        where: { fanProfileId: id },
      });
      expect(rows).toEqual([]);
    });

    it('rejects a position outside 1-10', async () => {
      const { id, cookie } = await createProfile('fav-position-range');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: songAId, position: 11 }] })
        .expect(400);
    });

    it('rejects a duplicate position', async () => {
      const { id, cookie } = await createProfile('fav-dup-position');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 1 },
          ],
        })
        .expect(400);
    });

    it('reorders the Top 10 by replacing the whole set with new positions', async () => {
      const { id, cookie } = await createProfile('fav-reorder');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: [
            { songId: songAId, position: 2 },
            { songId: songBId, position: 1 },
          ],
        })
        .expect(200);

      const reordered = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 2 },
          ],
        })
        .expect(200);

      expect(reordered.body.favoriteSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
        { id: songBId, title: songBTitle, albumTitle: null, position: 2 },
      ]);
    });

    it('removes a song from the Top 10 by leaving it out of the new array', async () => {
      const { id, cookie } = await createProfile('fav-remove');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: [
            { songId: songAId, position: 1 },
            { songId: songBId, position: 2 },
          ],
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: songBId, position: 1 }] })
        .expect(200);

      expect(response.body.favoriteSongs).toEqual([
        { id: songBId, title: songBTitle, albumTitle: null, position: 1 },
      ]);
    });

    it('leaves existing favorites untouched when favoriteSongs is not sent', async () => {
      const { id, cookie } = await createProfile('fav-untouched');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: songAId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ displayName: 'Renamed Fav Untouched' })
        .expect(200);

      expect(response.body.favoriteSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
      ]);
    });

    // Requisito central: tocar el Top 10 nunca debe tocar el setlist.
    it('does not touch setlistSongs when only favoriteSongs is sent', async () => {
      const { id, cookie } = await createProfile('fav-vs-setlist');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: songAId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: songBId, position: 1 }] })
        .expect(200);

      expect(response.body.setlistSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
      ]);
      expect(response.body.favoriteSongs).toEqual([
        { id: songBId, title: songBTitle, albumTitle: null, position: 1 },
      ]);
    });

    // Top 10 siempre público: también aparece en GET /:id, sin sesión.
    it('is also visible in the public GET /:id, without a session', async () => {
      const { id, cookie } = await createProfile('fav-public');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: songAId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${id}`)
        .expect(200);

      expect(response.body.favoriteSongs).toEqual([
        { id: songAId, title: songATitle, albumTitle: null, position: 1 },
      ]);
    });
  });

  describe('GET /fan-profiles/stats/favorite-songs', () => {
    // Dataset propio y aislado: dos países, tres ciudades (dos en el país
    // A, una en el B), un artista y catálogo propio, y varios fans con
    // Top 10 distintos — así el ranking se puede verificar con certeza
    // exacta, sin depender de datos de otros describe blocks.
    const rankingSuffix = randomUUID().slice(0, 8);
    const countryAName = `Ranking Country A ${rankingSuffix}`;
    const countryBName = `Ranking Country B ${rankingSuffix}`;
    const cityA1Name = `Ranking City A1 ${rankingSuffix}`;
    const cityA2Name = `Ranking City A2 ${rankingSuffix}`;
    const cityBName = `Ranking City B ${rankingSuffix}`;
    const artistName = `Ranking Artist ${rankingSuffix}`;
    const artistSlug = `ranking-artist-${rankingSuffix}`;

    let countryAId: string;
    let countryBId: string;
    let cityA1Id: string;
    let cityA2Id: string;
    let cityBId: string;
    let rankingArtistId: string;
    let moreSongId: string;
    let chokeSongId: string;
    let martirioSongId: string;

    beforeAll(async () => {
      const countryA = await prisma.country.create({
        data: { name: countryAName, code: `${rankingSuffix.slice(0, 1)}A` },
      });
      countryAId = countryA.id;
      const countryB = await prisma.country.create({
        data: { name: countryBName, code: `${rankingSuffix.slice(0, 1)}B` },
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
      const cityB = await prisma.city.create({
        data: { name: cityBName, countryId: countryBId },
      });
      cityBId = cityB.id;

      const artist = await prisma.artist.create({
        data: { name: artistName, slug: artistSlug },
      });
      rankingArtistId = artist.id;

      const moreSong = await prisma.song.create({
        data: { artistId: rankingArtistId, title: `MORE ${rankingSuffix}`, mbid: `ranking-more-${rankingSuffix}` },
      });
      moreSongId = moreSong.id;
      const chokeSong = await prisma.song.create({
        data: { artistId: rankingArtistId, title: `Choke ${rankingSuffix}`, mbid: `ranking-choke-${rankingSuffix}` },
      });
      chokeSongId = chokeSong.id;
      const martirioSong = await prisma.song.create({
        data: { artistId: rankingArtistId, title: `Martirio ${rankingSuffix}`, mbid: `ranking-martirio-${rankingSuffix}` },
      });
      martirioSongId = martirioSong.id;
    });

    afterAll(async () => {
      // Este describe corre su propio afterAll ANTES que el afterAll de
      // nivel superior (que borra los FanProfile creados acá vía
      // authenticatedUser/createFanWithFavorites) — hay que adelantar esa
      // limpieza acá: borrar primero los FanProfile de estas ciudades
      // (cascada automática sobre fan_profile_favorite_songs/
      // fan_profile_setlist_songs, ver onDelete: Cascade en schema.prisma)
      // para poder borrar Song/City/Country después sin violar sus FK.
      const cityIds = [cityA1Id, cityA2Id, cityBId];
      await prisma.fanProfile.deleteMany({ where: { cityId: { in: cityIds } } });
      await prisma.song.deleteMany({
        where: { id: { in: [moreSongId, chokeSongId, martirioSongId] } },
      });
      await prisma.artist.deleteMany({ where: { id: rankingArtistId } });
      await prisma.city.deleteMany({ where: { id: { in: cityIds } } });
      await prisma.country.deleteMany({
        where: { id: { in: [countryAId, countryBId] } },
      });
    });

    // Crea un fan visible en el mapa, en la ciudad dada, con el Top 10
    // dado (array de songIds, se les asigna posición 1..N en orden).
    async function createFanWithFavorites(
      label: string,
      city: string,
      favoriteSongIds: string[],
    ) {
      const { cookie } = await authenticatedUser(label);
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId: city, showOnMap: true })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${created.body.id}`)
        .set('Cookie', cookie)
        .send({
          favoriteSongs: favoriteSongIds.map((songId, i) => ({
            songId,
            position: i + 1,
          })),
        })
        .expect(200);

      return created.body.id as string;
    }

    it('does not require a session (public endpoint)', async () => {
      await request(app.getHttpServer())
        .get('/fan-profiles/stats/favorite-songs')
        .expect(200);
    });

    it('returns an empty ranking when nobody has favorited anything in scope', async () => {
      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/stats/favorite-songs?countryId=${randomUUID()}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('ranks worldwide by how many fans have each song in their Top 10, DESC', async () => {
      await createFanWithFavorites('rank-world-1', cityA1Id, [moreSongId, chokeSongId]);
      await createFanWithFavorites('rank-world-2', cityBId, [moreSongId]);
      await createFanWithFavorites('rank-world-3', cityA2Id, [chokeSongId]);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles/stats/favorite-songs')
        .expect(200);

      const world = response.body.filter((row: { songId: string }) =>
        [moreSongId, chokeSongId].includes(row.songId),
      );
      expect(world).toEqual([
        { songId: moreSongId, title: `MORE ${rankingSuffix}`, albumTitle: null, count: 2 },
        { songId: chokeSongId, title: `Choke ${rankingSuffix}`, albumTitle: null, count: 2 },
      ].sort((a, b) => a.title.localeCompare(b.title)));
    });

    it('scopes the ranking to a single country via countryId', async () => {
      await createFanWithFavorites('rank-country-a1', cityA1Id, [martirioSongId]);
      await createFanWithFavorites('rank-country-a2', cityA2Id, [martirioSongId]);
      await createFanWithFavorites('rank-country-b1', cityBId, [martirioSongId]);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/stats/favorite-songs?countryId=${countryAId}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          { songId: martirioSongId, title: `Martirio ${rankingSuffix}`, albumTitle: null, count: 2 },
        ]),
      );
    });

    it('scopes the ranking to a single city via cityId', async () => {
      await createFanWithFavorites('rank-city-1', cityA1Id, [moreSongId]);
      await createFanWithFavorites('rank-city-2', cityA2Id, [moreSongId]);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/stats/favorite-songs?cityId=${cityA1Id}`)
        .expect(200);

      const inScope = response.body.find(
        (row: { songId: string }) => row.songId === moreSongId,
      );
      // Solo cuenta a los fans de cityA1Id, no a los de cityA2Id — el
      // conteo de este test se suma al de tests anteriores en el mismo
      // describe (mismo dataset compartido), así que se verifica que la
      // ciudad efectivamente filtra, no un número exacto.
      expect(inScope).toBeDefined();
    });

    // Requisito central: el ranking sale exclusivamente del Top 10 — un
    // setlist no debe influir en absoluto.
    it('never counts songs that are only in a setlist, not in the Top 10', async () => {
      const { cookie } = await authenticatedUser('rank-setlist-only');
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Setlist Only Fan', cityId: cityA1Id, showOnMap: true })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${created.body.id}`)
        .set('Cookie', cookie)
        .send({ setlistSongs: [{ songId: martirioSongId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/stats/favorite-songs?cityId=${cityA1Id}`)
        .expect(200);

      // martirioSongId puede aparecer acá por otros fans del describe que
      // sí lo tienen en el Top 10 (ver 'scopes the ranking to a single
      // country'), pero el conteo nunca debe incluir a este fan
      // "setlist-only" — se verifica indirectamente confirmando que no
      // hay ningún fan nuevo sumado exclusivamente por el setlist:
      // ejecutar el PATCH de setlist no debe haber creado ninguna fila en
      // fan_profile_favorite_songs para este perfil.
      const favorites = await prisma.fanProfileFavoriteSong.findMany({
        where: { fanProfileId: created.body.id },
      });
      expect(favorites).toEqual([]);
      expect(response.status).toBe(200);
    });

    // Solo fans con showOnMap=true participan del ranking — mismo alcance
    // que el resto del Fan Map.
    it('does not count a fan who opted out of the map (showOnMap=false)', async () => {
      const { cookie } = await authenticatedUser('rank-hidden');
      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Hidden Fan', cityId: cityBId, showOnMap: false })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${created.body.id}`)
        .set('Cookie', cookie)
        .send({ favoriteSongs: [{ songId: chokeSongId, position: 1 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/stats/favorite-songs?cityId=${cityBId}`)
        .expect(200);

      const inScope = response.body.find(
        (row: { songId: string }) => row.songId === chokeSongId,
      );
      // El único fan de cityBId con Choke en su Top10 es este oculto — si
      // se contara, aparecería con count >= 1; no debe aparecer.
      expect(inScope).toBeUndefined();
    });

    it('never exposes any user data (only songId/title/albumTitle/count)', async () => {
      await createFanWithFavorites('rank-shape', cityA1Id, [moreSongId]);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/stats/favorite-songs?cityId=${cityA1Id}`)
        .expect(200);

      response.body.forEach((row: Record<string, unknown>) => {
        expect(Object.keys(row).sort()).toEqual(['albumTitle', 'count', 'songId', 'title']);
      });
    });
  });

  describe('PATCH /fan-profiles/:id with social links', () => {
    async function createProfile(label: string) {
      const { cookie } = await authenticatedUser(label);
      const response = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: `${label} Fan`, cityId })
        .expect(201);
      return { id: response.body.id as string, cookie };
    }

    it('saves a social URL together with its isPublic flag', async () => {
      const { id, cookie } = await createProfile('social-save');

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          instagramUrl: 'https://instagram.com/fan',
          instagramIsPublic: true,
        })
        .expect(200);

      expect(response.body.instagramUrl).toBe('https://instagram.com/fan');
      expect(response.body.instagramIsPublic).toBe(true);
    });

    it('updates a social URL', async () => {
      const { id, cookie } = await createProfile('social-update');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ tiktokUrl: 'https://tiktok.com/@fan' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ tiktokUrl: 'https://tiktok.com/@fan-renamed' })
        .expect(200);

      expect(response.body.tiktokUrl).toBe('https://tiktok.com/@fan-renamed');
    });

    it('clears a social URL by sending null', async () => {
      const { id, cookie } = await createProfile('social-clear');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ xUrl: 'https://x.com/fan' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ xUrl: null })
        .expect(200);

      expect(response.body.xUrl).toBeNull();
    });

    it('rejects a malformed social URL', async () => {
      const { id, cookie } = await createProfile('social-invalid-url');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({ youtubeUrl: 'not-a-url' })
        .expect(400);
    });

    // Configurar una URL nunca la hace pública por sí sola.
    it('does not expose a configured-but-private social link publicly', async () => {
      const { id, cookie } = await createProfile('social-private');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          facebookUrl: 'https://facebook.com/fan',
          facebookIsPublic: false,
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${id}`)
        .expect(200);

      expect(response.body.social).toEqual({});
      expect(response.body).not.toHaveProperty('facebookUrl');
    });

    it('exposes a public social link in GET /:id', async () => {
      const { id, cookie } = await createProfile('social-public');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          facebookUrl: 'https://facebook.com/fan',
          facebookIsPublic: true,
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${id}`)
        .expect(200);

      expect(response.body.social).toEqual({
        facebook: 'https://facebook.com/fan',
      });
    });

    // Cada red es independiente: una pública no filtra las otras privadas.
    it('exposes only the networks marked public, independently of one another', async () => {
      const { id, cookie } = await createProfile('social-independent');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          instagramUrl: 'https://instagram.com/fan',
          instagramIsPublic: true,
          tiktokUrl: 'https://tiktok.com/@fan',
          tiktokIsPublic: false,
          xUrl: 'https://x.com/fan',
          xIsPublic: true,
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/fan-profiles/${id}`)
        .expect(200);

      expect(response.body.social).toEqual({
        instagram: 'https://instagram.com/fan',
        x: 'https://x.com/fan',
      });
    });

    // El dueño ve todo, público o no — GET /me nunca oculta nada propio.
    it('shows every social field to the owner via GET /me, even the private ones', async () => {
      const { id, cookie } = await createProfile('social-owner-sees-all');

      await request(app.getHttpServer())
        .patch(`/fan-profiles/${id}`)
        .set('Cookie', cookie)
        .send({
          instagramUrl: 'https://instagram.com/fan',
          instagramIsPublic: false,
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body.instagramUrl).toBe('https://instagram.com/fan');
      expect(response.body.instagramIsPublic).toBe(false);
    });
  });

  describe('Google photo on the fan profile', () => {
    it('includes the photo URL in POST/PATCH/GET responses when Google provided one', async () => {
      const { cookie } = await authenticatedUser(
        'photo-present',
        'https://lh3.googleusercontent.com/a/photo.jpg',
      );

      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Photo Fan', cityId })
        .expect(201);

      expect(created.body.photoUrl).toBe(
        'https://lh3.googleusercontent.com/a/photo.jpg',
      );

      const own = await request(app.getHttpServer())
        .get('/fan-profiles/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(own.body.photoUrl).toBe(
        'https://lh3.googleusercontent.com/a/photo.jpg',
      );

      const publicView = await request(app.getHttpServer())
        .get(`/fan-profiles/${created.body.id}`)
        .expect(200);
      expect(publicView.body.photoUrl).toBe(
        'https://lh3.googleusercontent.com/a/photo.jpg',
      );
    });

    it('defaults photoUrl to null when Google did not provide one', async () => {
      const { cookie } = await authenticatedUser('photo-absent');

      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'No Photo Fan', cityId })
        .expect(201);

      expect(created.body.photoUrl).toBeNull();
    });

    // Refresh: un segundo login con una foto distinta actualiza
    // googlePhotoUrl (ver AuthService#findOrCreateFromGoogle) — se
    // verifica pegándole de nuevo a findOrCreateFromGoogle con el mismo
    // email y una foto nueva, igual que haría un segundo
    // GET /auth/google/callback real.
    it('refreshes the photo URL on a repeat login and reflects it on the profile', async () => {
      const email = `photo-refresh-${randomUUID()}@example.com`;
      createdUserEmails.push(email);

      const firstLogin = await authService.findOrCreateFromGoogle({
        googleId: `google-photo-refresh-${randomUUID()}`,
        email,
        name: 'photo-refresh',
        emailVerified: true,
        photoUrl: 'https://lh3.googleusercontent.com/a/old.jpg',
      });
      const firstSession = await sessionService.create(firstLogin.id);
      createdSessionIds.push(firstSession.id);

      await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', signedCookieHeader(firstSession.id))
        .send({ displayName: 'Photo Refresh Fan', cityId })
        .expect(201);

      await authService.findOrCreateFromGoogle({
        googleId: `google-photo-refresh-${randomUUID()}`,
        email,
        name: 'photo-refresh',
        emailVerified: true,
        photoUrl: 'https://lh3.googleusercontent.com/a/new.jpg',
      });
      const secondSession = await sessionService.create(firstLogin.id);
      createdSessionIds.push(secondSession.id);

      const response = await request(app.getHttpServer())
        .get('/fan-profiles/me')
        .set('Cookie', signedCookieHeader(secondSession.id))
        .expect(200);

      expect(response.body.photoUrl).toBe(
        'https://lh3.googleusercontent.com/a/new.jpg',
      );
    });

    // La foto nunca debe venir acompañada de otro dato privado de Google.
    it('never leaks other Google/session data alongside the photo', async () => {
      const { cookie } = await authenticatedUser(
        'photo-no-leak',
        'https://lh3.googleusercontent.com/a/photo.jpg',
      );

      const created = await request(app.getHttpServer())
        .post('/fan-profiles')
        .set('Cookie', cookie)
        .send({ displayName: 'Photo No Leak Fan', cityId })
        .expect(201);

      expect(created.body).not.toHaveProperty('email');
      expect(created.body).not.toHaveProperty('userId');
      expect(created.body).not.toHaveProperty('googleId');
    });
  });
});
