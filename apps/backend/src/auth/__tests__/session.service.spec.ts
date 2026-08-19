import { createHash } from 'node:crypto';
import { SessionService } from '@/auth/session.service';
import type { SessionRepository } from '@/db/repositories/session.repository';
import type { User } from '@/db/entities/user.entity';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createFakeSessionRepository(initialSession?: Record<string, unknown>) {
  const flush = jest.fn().mockResolvedValue(undefined);
  const persistAndFlush = jest.fn().mockResolvedValue(undefined);
  const nativeDelete = jest.fn().mockResolvedValue(1);
  const create = jest.fn((data: Record<string, unknown>) => ({ ...data }));
  const findOne = jest.fn().mockResolvedValue(initialSession ?? null);
  return {
    create,
    findOne,
    nativeDelete,
    getEntityManager: jest.fn(() => ({ persistAndFlush, flush })),
    persistAndFlush,
    flush,
  };
}

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    passwordHash: 'hash',
    role: 'moderator',
    status: 'active',
    ...overrides,
  } as User;
}

describe('SessionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('persists a hash of the opaque token with a 30-day expiry and returns the raw token', async () => {
      const repo = createFakeSessionRepository();
      const service = new SessionService(repo as unknown as SessionRepository);
      const user = createUser();

      const token = await service.create(user);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(repo.create).toHaveBeenCalledWith({
        user,
        tokenHash: hashToken(token),
        expiresAt: new Date('2026-01-31T00:00:00.000Z'),
      });
      expect(repo.persistAndFlush).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('returns null for an undefined token', async () => {
      const repo = createFakeSessionRepository();
      const service = new SessionService(repo as unknown as SessionRepository);

      expect(await service.validate(undefined)).toBeNull();
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('returns null when no session matches the token', async () => {
      const repo = createFakeSessionRepository(undefined);
      const service = new SessionService(repo as unknown as SessionRepository);

      expect(await service.validate('unknown-token')).toBeNull();
    });

    it('returns null and does not touch expiry when the session has expired', async () => {
      const user = createUser();
      const session = {
        tokenHash: hashToken('expired-token'),
        user,
        expiresAt: new Date('2025-12-31T23:59:59.000Z'),
      };
      const repo = createFakeSessionRepository(session);
      const service = new SessionService(repo as unknown as SessionRepository);

      expect(await service.validate('expired-token')).toBeNull();
      expect(repo.flush).not.toHaveBeenCalled();
    });

    it.each(['pending', 'deactivated'] as const)(
      'returns null when the session user status is %s',
      async (status) => {
        const user = createUser({ status });
        const session = {
          tokenHash: hashToken('some-token'),
          user,
          expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        };
        const repo = createFakeSessionRepository(session);
        const service = new SessionService(
          repo as unknown as SessionRepository,
        );

        expect(await service.validate('some-token')).toBeNull();
      },
    );

    it('returns the mapped AuthUser and slides expiresAt forward on success', async () => {
      const user = createUser({ id: 7, username: 'bob', role: 'admin' });
      const session = {
        tokenHash: hashToken('good-token'),
        user,
        expiresAt: new Date('2026-01-05T00:00:00.000Z'),
      };
      const repo = createFakeSessionRepository(session);
      const service = new SessionService(repo as unknown as SessionRepository);

      const result = await service.validate('good-token');

      expect(result).toEqual({
        user: { id: 7, username: 'bob', role: 'admin', status: 'active' },
      });
      expect(session.expiresAt).toEqual(new Date('2026-01-31T00:00:00.000Z'));
      expect(repo.flush).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('deletes the session row matching the hash of the token', async () => {
      const repo = createFakeSessionRepository();
      const service = new SessionService(repo as unknown as SessionRepository);

      await service.revoke('some-token');

      expect(repo.nativeDelete).toHaveBeenCalledWith({
        tokenHash: hashToken('some-token'),
      });
    });
  });

  describe('revokeAllForUser', () => {
    it('deletes every session row for the given user id', async () => {
      const repo = createFakeSessionRepository();
      const service = new SessionService(repo as unknown as SessionRepository);

      await service.revokeAllForUser(42);

      expect(repo.nativeDelete).toHaveBeenCalledWith({ user: 42 });
    });
  });
});
