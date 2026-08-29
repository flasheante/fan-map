// Config de AuthController resuelta por AuthModule a partir de env vars
// (WEB_APP_URL, SESSION_SECURE/NODE_ENV — ver auth.module.ts). Inyectada
// por token en vez de que el controller lea process.env directamente, para
// que sea un plain constructor arg en los tests (ver auth.controller.spec.ts).
export const AUTH_CONTROLLER_CONFIG = Symbol('AUTH_CONTROLLER_CONFIG');

export interface AuthControllerConfig {
  webAppUrl: string;
  secureCookies: boolean;
}
