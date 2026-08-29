import { SessionService } from './session.service';
import { PrismaService } from '../database/prisma.service';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: {
    session: {
      create: jest.Mock;
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const user = {
    id: 'user-1',
    email: 'fan@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new SessionService(prisma as unknown as PrismaService, ONE_WEEK_MS);
  });

  describe('create', () => {
    it('persists a session for the user, expiring maxAgeMs from now', async () => {
      const before = Date.now();
      prisma.session.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'session-1', ...data, createdAt: new Date() }),
      );

      const session = await service.create(user.id);

      const call = prisma.session.create.mock.calls[0][0];
      expect(call.data.userId).toBe(user.id);
      const expiresAtMs = call.data.expiresAt.getTime();
      expect(expiresAtMs).toBeGreaterThanOrEqual(before + ONE_WEEK_MS);
      expect(expiresAtMs).toBeLessThanOrEqual(Date.now() + ONE_WEEK_MS);
      expect(session.id).toBe('session-1');
    });
  });

  describe('validate', () => {
    it('returns the public user for an existing, non-expired session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        expiresAt: new Date(Date.now() + ONE_WEEK_MS),
        createdAt: new Date(),
        user,
      });

      const result = await service.validate('session-1');

      expect(result).toEqual({ id: user.id, email: user.email });
      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: { user: true },
      });
    });

    it('returns null when the session does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      const result = await service.validate('missing-session');

      expect(result).toBeNull();
    });

    it('returns null and deletes the row when the session has expired', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        createdAt: new Date('1999-12-31T00:00:00.000Z'),
        user,
      });

      const result = await service.validate('session-1');

      expect(result).toBeNull();
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('never leaks the full User row (only id and email)', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        expiresAt: new Date(Date.now() + ONE_WEEK_MS),
        createdAt: new Date(),
        user,
      });

      const result = await service.validate('session-1');

      expect(Object.keys(result!)).toEqual(['id', 'email']);
    });
  });

  describe('invalidate', () => {
    it('deletes the session row', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.invalidate('session-1');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('is idempotent when the session no longer exists', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.invalidate('already-gone')).resolves.not.toThrow();
    });
  });
});
