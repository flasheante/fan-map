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

// Flujo e2e de la sesión de Auth ya establecida, sin OAuth real contra
// Google (ver reglas de la Etapa 1): el User y la Session se crean acá
// directamente vía AuthService/SessionService (los mismos servicios que
// usa AuthController#googleCallback), simulando lo que ese callback haría
// después de un login exitoso. Lo que se ejercita end-to-end es lo que va
// después de Google: cookie firmada → SessionAuthGuard → request.user →
// /auth/me → /auth/logout → /auth/me vuelve a dar 401.
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let sessionService: SessionService;

  const sessionSecret = process.env.SESSION_SECRET ?? 'dev-insecure-session-secret';
  const suffix = randomUUID().slice(0, 8);
  const email = `auth-e2e-${suffix}@example.com`;

  let userId: string;
  const createdSessionIds: string[] = [];

  function signedCookieHeader(sessionId: string): string {
    const signed = `s:${sign(sessionId, sessionSecret)}`;
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    // main.ts aplica cookie-parser en bootstrap(), que este setup de test
    // no ejecuta — hace falta declararlo también acá (mismo secreto que
    // usaría la app real) para que req.signedCookies exista.
    app.use(cookieParser(sessionSecret));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    sessionService = app.get(SessionService);

    const user = await authService.findOrCreateFromGoogle({
      googleId: `google-${suffix}`,
      email,
      name: 'Auth E2E',
      emailVerified: true,
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { id: { in: createdSessionIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('rejects /auth/me with no session cookie', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects /auth/me with a forged (badly-signed) session cookie', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=not-a-real-signed-value`)
      .expect(401);
  });

  it('rejects /auth/me with a well-signed cookie pointing at a session that does not exist', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', signedCookieHeader(randomUUID()))
      .expect(401);
  });

  it('demonstrates the full session lifecycle: create → /auth/me → logout → /auth/me is 401 again', async () => {
    const session = await sessionService.create(userId);
    createdSessionIds.push(session.id);
    const cookie = signedCookieHeader(session.id);

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    // Solo id + email — nunca datos internos de OAuth ni tokens.
    expect(meResponse.body).toEqual({ id: userId, email });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('does not create a duplicate User when the same Google identity logs in twice', async () => {
    const again = await authService.findOrCreateFromGoogle({
      googleId: `google-${suffix}`,
      email,
      name: 'Auth E2E',
      emailVerified: true,
    });

    expect(again.id).toBe(userId);

    const usersWithEmail = await prisma.user.findMany({ where: { email } });
    expect(usersWithEmail).toHaveLength(1);
  });
});
