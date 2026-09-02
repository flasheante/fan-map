import { randomBytes } from 'crypto';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { GoogleOAuthClient } from './google-oauth.client';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionAuthGuard } from './session-auth.guard';
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './auth.constants';
import { AUTH_CONTROLLER_CONFIG } from './auth.tokens';
import type { AuthControllerConfig } from './auth.tokens';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

// GET /auth/google              → redirect a Google
// GET /auth/google/callback     → crea/encuentra User, crea sesión, redirect
// GET /auth/me                  → usuario autenticado (o 401)
// POST /auth/logout             → invalida la sesión
//
// El `state` anti-CSRF del flow OAuth se maneja acá con nuestra propia
// cookie firmada (ver decisión en google-oauth.client.ts) en vez de
// delegarlo a una librería de sesión: se genera en /google, se guarda en
// una cookie firmada de corta duración, y se compara contra el query param
// `state` que Google devuelve en /google/callback antes de confiar en el
// `code`.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleOAuth: GoogleOAuthClient,
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    @Inject(AUTH_CONTROLLER_CONFIG) private readonly config: AuthControllerConfig,
  ) {}

  @Get('google')
  googleLogin(@Res() res: Response) {
    const state = randomBytes(16).toString('hex');
    res.cookie(
      OAUTH_STATE_COOKIE_NAME,
      state,
      this.cookieOptions(OAUTH_STATE_MAX_AGE_MS),
    );
    res.redirect(this.googleOAuth.getAuthUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookieState = req.signedCookies?.[OAUTH_STATE_COOKIE_NAME] as
      | string
      | false
      | undefined;
    // Se borra siempre, matchee o no: es de un solo uso.
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, this.cookieOptions());

    if (!code || !state || !cookieState || state !== cookieState) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const identity = await this.googleOAuth.getIdentity(code);
    const user = await this.authService.findOrCreateFromGoogle(identity);
    const session = await this.sessions.create(user.id);

    res.cookie(SESSION_COOKIE_NAME, session.id, {
      ...this.cookieOptions(),
      expires: session.expiresAt,
    });
    res.redirect(this.config.webAppUrl);
  }

  // Protegido por SessionAuthGuard: si llega acá, request.user ya es
  // nuestro User público (id, email) — nunca el objeto crudo de Google ni
  // el modelo Prisma completo.
  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.invalidate(req.sessionId!);
    res.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
    return { success: true };
  }

  private cookieOptions(maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      // web y api pueden ser sitios distintos en producción (Vercel + api
      // desplegada aparte, no sólo puertos distintos como en dev): con
      // SameSite=Lax el browser descarta esta cookie en los
      // fetch(credentials:"include") cross-site del frontend (GET
      // /auth/me, POST /fan-profiles, etc. — Lax sólo viaja en
      // navegaciones de documento completas, como el propio redirect de
      // /google/callback), así que el login "pega" en Google pero la app
      // nunca ve la sesión. None arregla eso, y requiere Secure — por
      // ende sólo se usa cuando `secureCookies` ya es true; en local
      // (secureCookies=false, sin HTTPS) los browsers rechazan de plano
      // una cookie None sin Secure, así que ahí se mantiene Lax, que ya
      // alcanza porque localhost:3000/3001 son el mismo site.
      sameSite: this.config.secureCookies ? 'none' : 'lax',
      signed: true,
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }
}
