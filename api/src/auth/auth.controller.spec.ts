import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { GoogleOAuthClient } from './google-oauth.client';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './auth.constants';

function makeResponse(): jest.Mocked<Response> {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as jest.Mocked<Response>;
}

describe('AuthController', () => {
  let controller: AuthController;
  let googleOAuth: { getAuthUrl: jest.Mock; getIdentity: jest.Mock };
  let authService: { findOrCreateFromGoogle: jest.Mock };
  let sessions: { create: jest.Mock; invalidate: jest.Mock };

  const config = {
    webAppUrl: 'http://localhost:3001',
    secureCookies: false,
  };

  const identity = {
    googleId: 'google-subject-123',
    email: 'fan@example.com',
    name: 'Fan Name',
    emailVerified: true,
  };
  const user = {
    id: 'user-1',
    email: 'fan@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const session = {
    id: 'session-1',
    userId: 'user-1',
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    createdAt: new Date(),
  };

  beforeEach(() => {
    googleOAuth = { getAuthUrl: jest.fn(), getIdentity: jest.fn() };
    authService = { findOrCreateFromGoogle: jest.fn() };
    sessions = { create: jest.fn(), invalidate: jest.fn() };

    controller = new AuthController(
      googleOAuth as unknown as GoogleOAuthClient,
      authService as unknown as AuthService,
      sessions as unknown as SessionService,
      config,
    );
  });

  describe('GET /auth/google', () => {
    it('sets a signed oauth-state cookie and redirects to the Google auth URL built from it', () => {
      googleOAuth.getAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=abc');
      const res = makeResponse();

      controller.googleLogin(res);

      const [cookieName, state, options] = res.cookie.mock.calls[0];
      expect(cookieName).toBe(OAUTH_STATE_COOKIE_NAME);
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
      expect(options).toMatchObject({ httpOnly: true, signed: true, sameSite: 'lax' });
      expect(googleOAuth.getAuthUrl).toHaveBeenCalledWith(state);
      expect(res.redirect).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      );
    });

    // Bug reportado: en producción, web (Vercel) y api (desplegada aparte)
    // son dominios distintos → sitios distintos para el browser. Con
    // SameSite=Lax, un fetch(credentials:"include") cross-site desde web
    // nunca manda la cookie de vuelta (Lax sólo viaja en navegaciones de
    // documento completas), así que GET /auth/me siempre da 401 después
    // del login y el usuario nunca "avanza" más allá de "Continuar con
    // Google" — ver auth.constants.ts. SameSite=None (que exige Secure,
    // ya true acá) es lo que corrige eso.
    it("uses SameSite=None when cookies are secure (cross-site prod deploy)", () => {
      googleOAuth.getAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?state=abc");
      const secureController = new AuthController(
        googleOAuth as unknown as GoogleOAuthClient,
        authService as unknown as AuthService,
        sessions as unknown as SessionService,
        { ...config, secureCookies: true },
      );
      const res = makeResponse();

      secureController.googleLogin(res);

      const [, , options] = res.cookie.mock.calls[0];
      expect(options).toMatchObject({ secure: true, sameSite: "none" });
    });
  });

  describe('GET /auth/google/callback', () => {
    function makeRequest(cookieState: unknown): Request {
      return { signedCookies: { [OAUTH_STATE_COOKIE_NAME]: cookieState } } as unknown as Request;
    }

    it('finds/creates the User, creates a session, sets the session cookie and redirects to the web app', async () => {
      googleOAuth.getIdentity.mockResolvedValue(identity);
      authService.findOrCreateFromGoogle.mockResolvedValue(user);
      sessions.create.mockResolvedValue(session);
      const req = makeRequest('matching-state');
      const res = makeResponse();

      await controller.googleCallback('auth-code', 'matching-state', req, res);

      expect(googleOAuth.getIdentity).toHaveBeenCalledWith('auth-code');
      expect(authService.findOrCreateFromGoogle).toHaveBeenCalledWith(identity);
      expect(sessions.create).toHaveBeenCalledWith(user.id);
      expect(res.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.anything(),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        session.id,
        expect.objectContaining({
          httpOnly: true,
          signed: true,
          sameSite: 'lax',
          expires: session.expiresAt,
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(config.webAppUrl);
    });

    // Mismo caso que en GET /auth/google, pero para la cookie de sesión
    // real: es la que después hace o no hace que GET /auth/me,
    // GET /fan-profiles/me y POST /fan-profiles vean al usuario logueado.
    it("uses SameSite=None when cookies are secure (cross-site prod deploy)", async () => {
      googleOAuth.getIdentity.mockResolvedValue(identity);
      authService.findOrCreateFromGoogle.mockResolvedValue(user);
      sessions.create.mockResolvedValue(session);
      const secureController = new AuthController(
        googleOAuth as unknown as GoogleOAuthClient,
        authService as unknown as AuthService,
        sessions as unknown as SessionService,
        { ...config, secureCookies: true },
      );
      const req = makeRequest("matching-state");
      const res = makeResponse();

      await secureController.googleCallback("auth-code", "matching-state", req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        session.id,
        expect.objectContaining({ secure: true, sameSite: "none" }),
      );
    });

    it('rejects when the state query param does not match the oauth-state cookie', async () => {
      const req = makeRequest('cookie-state');
      const res = makeResponse();

      await expect(
        controller.googleCallback('auth-code', 'different-state', req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(googleOAuth.getIdentity).not.toHaveBeenCalled();
    });

    it('rejects when there is no oauth-state cookie at all (forged/expired callback)', async () => {
      const req = makeRequest(undefined);
      const res = makeResponse();

      await expect(
        controller.googleCallback('auth-code', 'some-state', req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(googleOAuth.getIdentity).not.toHaveBeenCalled();
    });

    it('rejects when Google did not send a code', async () => {
      const req = makeRequest('matching-state');
      const res = makeResponse();

      await expect(
        controller.googleCallback(undefined as unknown as string, 'matching-state', req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(googleOAuth.getIdentity).not.toHaveBeenCalled();
    });

    it('always clears the oauth-state cookie, even when validation fails', async () => {
      const req = makeRequest('cookie-state');
      const res = makeResponse();

      await expect(
        controller.googleCallback('auth-code', 'different-state', req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(res.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.anything(),
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns request.user as-is (already resolved by SessionAuthGuard)', () => {
      const req = { user: { id: 'user-1', email: 'fan@example.com' } } as unknown as Request;

      expect(controller.me(req)).toEqual({ id: 'user-1', email: 'fan@example.com' });
    });
  });

  describe('POST /auth/logout', () => {
    it('invalidates the session and clears the session cookie', async () => {
      const req = { sessionId: 'session-1' } as unknown as Request;
      const res = { clearCookie: jest.fn() } as unknown as jest.Mocked<Response>;

      const result = await controller.logout(req, res);

      expect(sessions.invalidate).toHaveBeenCalledWith('session-1');
      expect(res.clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.anything(),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
