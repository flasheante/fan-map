// Nombre de la cookie httpOnly que guarda el id de sesión (ver
// SessionService) — el valor de la cookie ES el Session.id, no un JWT.
export const SESSION_COOKIE_NAME = 'fanmap_session';

// Cookie corta usada solo durante el roundtrip OAuth (GET /auth/google →
// Google → GET /auth/google/callback) para validar el parámetro `state`
// anti-CSRF. No tiene relación con la sesión de la app: se borra en el
// callback se cumpla o no la validación.
export const OAUTH_STATE_COOKIE_NAME = 'fanmap_oauth_state';
export const OAUTH_STATE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos alcanzan de sobra para el redirect a Google y de vuelta.

// Cookie corta, mismo criterio que OAUTH_STATE_COOKIE_NAME (un solo uso,
// se borra en el callback matchee o no), que recuerda a qué path del front
// volver después del roundtrip OAuth — el path desde el que se pidió
// GET /auth/google (ej. "/join" o "/profile"). Sin esto, el callback
// siempre redirige a la raíz del front (`webAppUrl`) sin importar de dónde
// vino el login: el usuario se loguea bien pero "aparece" en la landing en
// vez de donde estaba (bug reportado — probar navegación mobile).
export const OAUTH_RETURN_TO_COOKIE_NAME = 'fanmap_oauth_return_to';

// Sólo un path relativo al propio front, nunca otro host: si `returnTo`
// llegara sin sanear hasta la cookie y de ahí al redirect final, un link
// armado como GET /auth/google?returnTo=https://sitio-trucho.com (o
// //sitio-trucho.com, que el browser también trata como absoluto) volvería
// un login legítimo en un open redirect. Exige que empiece con exactamente
// una "/" y no tenga espacios en blanco.
const SAFE_RETURN_TO_PATH = /^\/(?!\/|\\)\S*$/;

export function sanitizeReturnTo(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return SAFE_RETURN_TO_PATH.test(raw) ? raw : undefined;
}

// 7 días. Ver SESSION_MAX_AGE en .env.example.
export const DEFAULT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Convierte SESSION_MAX_AGE (ms, string) a un número usable por
// SessionService. Mismo patrón que resolveRequestsPerSecond en
// setlist-fm.module.ts: nunca lanza por una env var mal configurada, cae al
// default ante undefined/no-numérico/cero/negativo.
export function resolveSessionMaxAgeMs(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SESSION_MAX_AGE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SESSION_MAX_AGE_MS;
}

// Decide el flag `secure` de las cookies de auth. SESSION_SECURE, si está
// seteada explícitamente ("true"/"false"), siempre gana; si no está
// seteada, se infiere de NODE_ENV (secure por defecto en producción, no
// secure en desarrollo/test — donde normalmente no hay HTTPS local).
export function resolveSecureCookie(
  sessionSecure: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  if (sessionSecure === 'true') return true;
  if (sessionSecure === 'false') return false;
  return nodeEnv === 'production';
}
