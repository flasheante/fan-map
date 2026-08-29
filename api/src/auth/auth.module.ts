import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionAuthGuard } from './session-auth.guard';
import { GoogleOAuthClient } from './google-oauth.client';
import { resolveSecureCookie, resolveSessionMaxAgeMs } from './auth.constants';
import { AUTH_CONTROLLER_CONFIG, AuthControllerConfig } from './auth.tokens';

// Único lugar donde Auth lee variables de entorno (GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, SESSION_MAX_AGE,
// SESSION_SECURE, WEB_APP_URL — ver .env.example): mismo patrón que
// SetlistFmModule con SETLIST_FM_REQUESTS_PER_SECOND. GoogleOAuthClient,
// SessionService y AuthControllerConfig quedan libres de process.env, así
// que se testean con valores fijos en sus *.spec.ts.
//
// No se valida acá que las credenciales de Google existan: si faltan, la
// app igual bootea (necesario para no romper los tests/e2e existentes que
// levantan AppModule completo sin esas env vars configuradas) y solo
// falla al pegarle de verdad a GET /auth/google — fuera del alcance de
// esta etapa (no se hace OAuth real contra Google).
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: GoogleOAuthClient,
      useFactory: () =>
        new GoogleOAuthClient({
          clientId: process.env.GOOGLE_CLIENT_ID ?? '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
        }),
    },
    {
      provide: SessionService,
      useFactory: (prisma: PrismaService) =>
        new SessionService(
          prisma,
          resolveSessionMaxAgeMs(process.env.SESSION_MAX_AGE),
        ),
      inject: [PrismaService],
    },
    SessionAuthGuard,
    {
      provide: AUTH_CONTROLLER_CONFIG,
      useFactory: (): AuthControllerConfig => ({
        webAppUrl: process.env.WEB_APP_URL ?? 'http://localhost:3001',
        secureCookies: resolveSecureCookie(
          process.env.SESSION_SECURE,
          process.env.NODE_ENV,
        ),
      }),
    },
  ],
  exports: [SessionService, SessionAuthGuard],
})
export class AuthModule {}
