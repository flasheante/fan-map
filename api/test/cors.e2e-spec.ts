import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// web y api corren en orígenes distintos incluso en dev (ver main.ts): sin
// CORS habilitado, el browser bloquea cualquier fetch del frontend que
// necesite la cookie de sesión (credentials: "include"). Este suite replica
// la configuración de bootstrap() (ver ese comentario para el porqué) para
// poder verificarla end-to-end, igual que auth.e2e-spec.ts replica
// ValidationPipe/cookie-parser.
describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.enableCors({ origin: webAppUrl, credentials: true });
    app.use(cookieParser(process.env.SESSION_SECRET ?? 'dev-insecure-session-secret'));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the configured web origin with credentials on a simple GET', async () => {
    const response = await request(app.getHttpServer())
      .get('/artists')
      .set('Origin', webAppUrl)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(webAppUrl);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  // Preflight que dispararía el browser antes de un POST /fan-profiles con
  // Content-Type: application/json y credentials: "include".
  it('answers the preflight for an authenticated POST with credentials', async () => {
    const response = await request(app.getHttpServer())
      .options('/fan-profiles')
      .set('Origin', webAppUrl)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(webAppUrl);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toEqual(
      expect.stringContaining('POST'),
    );
  });
});
