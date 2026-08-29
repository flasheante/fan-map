import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // web y api corren en orígenes distintos incluso en desarrollo (:3001 vs
  // :3000 — ver WEB_APP_URL en auth.module.ts, ya apunta al origin de web).
  // Sin esto, cualquier fetch del frontend que necesite la cookie de sesión
  // (GET /auth/me, POST /fan-profiles, etc. con credentials:"include") es
  // bloqueado por el browser: el origin es fijo (no una whitelist ni "*")
  // porque un request con credentials no puede combinarse con
  // Access-Control-Allow-Origin: "*".
  app.enableCors({
    origin: process.env.WEB_APP_URL ?? 'http://localhost:3001',
    credentials: true,
  });
  // SESSION_SECRET firma las cookies de auth (sesión + oauth state — ver
  // src/auth): sin esto req.signedCookies nunca se puebla y SessionAuthGuard
  // rechazaría toda request. El fallback es solo para dev/test sin .env
  // configurado; en producción debe setearse un secreto real (ver .env.example).
  app.use(cookieParser(process.env.SESSION_SECRET ?? 'dev-insecure-session-secret'));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
