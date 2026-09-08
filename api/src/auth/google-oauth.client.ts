import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleIdentity } from './interfaces/google-identity.interface';

export interface GoogleOAuthClientConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];

// Envoltorio delgado sobre google-auth-library (el cliente oficial de
// Google para Node), la única pieza de este módulo que habla con Google.
// Se inyecta la config en vez de leer process.env acá adentro (ver
// auth.module.ts, que sí la lee) para que sea trivial de testear sin red
// real ni variables de entorno — ver google-oauth.client.spec.ts, que
// mockea OAuth2Client.prototype en vez de pegarle a Google.
//
// Se eligió google-auth-library en vez de @nestjs/passport +
// passport-google-oauth20 porque esta última necesita almacenamiento de
// sesión (req.session, típicamente express-session) solo para el parámetro
// `state` anti-CSRF del flow OAuth. Acá el `state` se maneja con nuestra
// propia cookie firmada (ver auth.controller.ts), reutilizando la misma
// infraestructura de cookies que ya hace falta para la sesión de la app,
// sin sumar una segunda noción de "sesión" (Passport) desconectada de la
// nuestra (Postgres).
@Injectable()
export class GoogleOAuthClient {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(config: GoogleOAuthClientConfig) {
    this.clientId = config.clientId;
    this.client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.callbackUrl,
    );
  }

  // Arma la URL de autorización de Google a la que se redirige al usuario
  // en GET /auth/google. `state` es generado y validado por el caller
  // (nuestra cookie firmada), no por esta clase.
  getAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      access_type: 'online',
      scope: GOOGLE_OAUTH_SCOPES,
      state,
    });
  }

  // Intercambia el `code` del callback por tokens y verifica el ID token
  // (firma + audience) para extraer la identidad — verifyIdToken hace la
  // validación criptográfica, así que no hace falta una segunda llamada a
  // Google para "obtener el perfil". Nunca se devuelve accessToken ni
  // idToken al caller: solo los claims mínimos que necesitamos.
  async getIdentity(code: string): Promise<GoogleIdentity> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) {
      throw new UnauthorizedException('Google did not return an ID token');
    }

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google account has no email');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      emailVerified: payload.email_verified ?? false,
      photoUrl: payload.picture ?? null,
    };
  }
}
