import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleOAuthClient } from './google-oauth.client';

// GoogleOAuthClient envuelve google-auth-library's OAuth2Client. Nunca se
// hace una request real a Google en estos tests: se mockean los métodos de
// OAuth2Client.prototype que hacen I/O (generateAuthUrl, getToken,
// verifyIdToken), siguiendo la instrucción de no depender de Google real.
describe('GoogleOAuthClient', () => {
  let client: GoogleOAuthClient;

  beforeEach(() => {
    client = new GoogleOAuthClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'http://localhost:3000/auth/google/callback',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthUrl', () => {
    it('builds a Google authorization URL carrying the given state', () => {
      const generateAuthUrl = jest
        .spyOn(OAuth2Client.prototype, 'generateAuthUrl')
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=abc123');

      const url = client.getAuthUrl('abc123');

      expect(generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'abc123',
          scope: expect.arrayContaining(['openid', 'email', 'profile']),
        }),
      );
      expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?state=abc123');
    });
  });

  describe('getIdentity', () => {
    it('exchanges the code and returns the identity from the verified ID token', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: { id_token: 'fake-id-token' } } as never);
      const getPayload = jest.fn().mockReturnValue({
        sub: 'google-subject-123',
        email: 'fan@example.com',
        email_verified: true,
        name: 'Fan Name',
      });
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({ getPayload } as never);

      const identity = await client.getIdentity('auth-code');

      expect(identity).toEqual({
        googleId: 'google-subject-123',
        email: 'fan@example.com',
        name: 'Fan Name',
        emailVerified: true,
        photoUrl: null,
      });
    });

    // Etapa Perfil de FanMap: el ID token ya trae `picture` con el scope
    // actual (openid/email/profile, ver GOOGLE_OAUTH_SCOPES) — no hace
    // falta pedir nada nuevo a Google, solo leer el claim.
    it('includes the photo URL from the "picture" claim when present', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: { id_token: 'fake-id-token' } } as never);
      const getPayload = jest.fn().mockReturnValue({
        sub: 'google-subject-123',
        email: 'fan@example.com',
        email_verified: true,
        picture: 'https://lh3.googleusercontent.com/a/photo.jpg',
      });
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({ getPayload } as never);

      const identity = await client.getIdentity('auth-code');

      expect(identity.photoUrl).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
    });

    it('defaults photoUrl to null when Google omits the "picture" claim', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: { id_token: 'fake-id-token' } } as never);
      const getPayload = jest.fn().mockReturnValue({
        sub: 'google-subject-123',
        email: 'fan@example.com',
        email_verified: true,
      });
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({ getPayload } as never);

      const identity = await client.getIdentity('auth-code');

      expect(identity.photoUrl).toBeNull();
    });

    it('defaults name to null when Google does not provide one', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: { id_token: 'fake-id-token' } } as never);
      const getPayload = jest.fn().mockReturnValue({
        sub: 'google-subject-123',
        email: 'fan@example.com',
        email_verified: true,
      });
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({ getPayload } as never);

      const identity = await client.getIdentity('auth-code');

      expect(identity.name).toBeNull();
    });

    it('defaults emailVerified to false when Google omits the claim', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: { id_token: 'fake-id-token' } } as never);
      const getPayload = jest.fn().mockReturnValue({
        sub: 'google-subject-123',
        email: 'fan@example.com',
      });
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({ getPayload } as never);

      const identity = await client.getIdentity('auth-code');

      expect(identity.emailVerified).toBe(false);
    });

    it('throws Unauthorized when Google does not return an ID token', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: {} } as never);

      await expect(client.getIdentity('auth-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized when the verified payload has no email', async () => {
      jest
        .spyOn(OAuth2Client.prototype, 'getToken')
        .mockResolvedValue({ tokens: { id_token: 'fake-id-token' } } as never);
      const getPayload = jest.fn().mockReturnValue({ sub: 'google-subject-123' });
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({ getPayload } as never);

      await expect(client.getIdentity('auth-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
