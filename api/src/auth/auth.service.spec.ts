import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import type { GoogleIdentity } from './interfaces/google-identity.interface';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { upsert: jest.Mock } };

  const verifiedIdentity: GoogleIdentity = {
    googleId: 'google-subject-123',
    email: 'fan@example.com',
    name: 'Fan Name',
    emailVerified: true,
    photoUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
  };

  const existingUser = {
    id: 'user-1',
    email: 'fan@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = { user: { upsert: jest.fn() } };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('finds the existing User by email and returns it', async () => {
    prisma.user.upsert.mockResolvedValue(existingUser);

    const user = await service.findOrCreateFromGoogle(verifiedIdentity);

    expect(user).toEqual(existingUser);
  });

  it('creates the User by email when none exists yet, with the photo URL', async () => {
    const createdUser = { ...existingUser, id: 'user-2' };
    prisma.user.upsert.mockResolvedValue(createdUser);

    const user = await service.findOrCreateFromGoogle(verifiedIdentity);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: verifiedIdentity.email },
      update: { googlePhotoUrl: verifiedIdentity.photoUrl },
      create: {
        email: verifiedIdentity.email,
        googlePhotoUrl: verifiedIdentity.photoUrl,
      },
    });
    expect(user).toEqual(createdUser);
  });

  // El upsert atómico (unique constraint en User.email) es lo que evita el
  // duplicado ante logins concurrentes con el mismo email — a diferencia de
  // un find-then-create manual, acá no hay ventana de carrera posible.
  //
  // Etapa Perfil de FanMap: a diferencia de email, `googlePhotoUrl` sí se
  // refresca en cada login (update ya no es `{}`) — una foto de perfil de
  // Google puede cambiar, no tiene sentido quedarse con una vieja para
  // siempre. `googleId` sigue deliberadamente fuera de User (no lo pide
  // esta etapa).
  it('writes only email and googlePhotoUrl onto User — never googleId', async () => {
    prisma.user.upsert.mockResolvedValue(existingUser);

    await service.findOrCreateFromGoogle(verifiedIdentity);

    const call = prisma.user.upsert.mock.calls[0][0];
    expect(call.create).toEqual({
      email: verifiedIdentity.email,
      googlePhotoUrl: verifiedIdentity.photoUrl,
    });
    expect(call.update).toEqual({ googlePhotoUrl: verifiedIdentity.photoUrl });
    expect(call.create).not.toHaveProperty('googleId');
    expect(call.update).not.toHaveProperty('googleId');
  });

  it('refreshes googlePhotoUrl on an existing User (repeat login)', async () => {
    prisma.user.upsert.mockResolvedValue({
      ...existingUser,
      googlePhotoUrl: 'https://lh3.googleusercontent.com/a/new-photo.jpg',
    });

    await service.findOrCreateFromGoogle({
      ...verifiedIdentity,
      photoUrl: 'https://lh3.googleusercontent.com/a/new-photo.jpg',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { googlePhotoUrl: 'https://lh3.googleusercontent.com/a/new-photo.jpg' },
      }),
    );
  });

  it('persists a null googlePhotoUrl when Google does not provide a photo', async () => {
    prisma.user.upsert.mockResolvedValue(existingUser);

    await service.findOrCreateFromGoogle({ ...verifiedIdentity, photoUrl: null });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ googlePhotoUrl: null }),
        update: { googlePhotoUrl: null },
      }),
    );
  });

  it('rejects an identity whose email Google has not verified', async () => {
    const unverifiedIdentity: GoogleIdentity = {
      ...verifiedIdentity,
      emailVerified: false,
    };

    await expect(
      service.findOrCreateFromGoogle(unverifiedIdentity),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
