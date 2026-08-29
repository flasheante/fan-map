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

  it('creates the User by email when none exists yet', async () => {
    const createdUser = { ...existingUser, id: 'user-2' };
    prisma.user.upsert.mockResolvedValue(createdUser);

    const user = await service.findOrCreateFromGoogle(verifiedIdentity);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: verifiedIdentity.email },
      update: {},
      create: { email: verifiedIdentity.email },
    });
    expect(user).toEqual(createdUser);
  });

  // El upsert atómico (unique constraint en User.email) es lo que evita el
  // duplicado ante logins concurrentes con el mismo email — a diferencia de
  // un find-then-create manual, acá no hay ventana de carrera posible.
  it('never writes Google-specific fields onto User (only email)', async () => {
    prisma.user.upsert.mockResolvedValue(existingUser);

    await service.findOrCreateFromGoogle(verifiedIdentity);

    const call = prisma.user.upsert.mock.calls[0][0];
    expect(call.create).toEqual({ email: verifiedIdentity.email });
    expect(call.update).toEqual({});
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
