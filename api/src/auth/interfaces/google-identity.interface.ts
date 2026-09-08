// Identidad mínima que extraemos de Google tras el intercambio OAuth (ver
// GoogleOAuthClient#getIdentity). Deliberadamente no incluye tokens de
// Google ni ningún otro dato de la cuenta: es lo único que cruza la
// frontera entre "lo que dice Google" y "lo que persiste AuthService".
export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  // Del claim `picture` del ID token — ya viene con el scope actual
  // (openid/email/profile), Google no siempre lo entrega.
  photoUrl: string | null;
}
