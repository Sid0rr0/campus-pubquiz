import { UniqueConstraintViolationException } from '@mikro-orm/core';
import * as bcrypt from 'bcryptjs';
import {
  AccountDeactivatedError,
  AccountPendingError,
  AuthService,
  InvalidCredentialsError,
  UsernameTakenError,
} from '@/auth/auth.service';
import type { UserRepository } from '@/db/repositories/user.repository';
import type { SessionService } from '@/auth/session.service';
import type { User } from '@/db/entities/user.entity';

function createFakeUserRepository(users: Partial<User>[] = []) {
  const flush = jest.fn().mockResolvedValue(undefined);
  const persistAndFlush = jest.fn().mockResolvedValue(undefined);
  const create = jest.fn((data: Record<string, unknown>) => ({ ...data }));
  const findOne = jest.fn((where: Record<string, unknown>) =>
    Promise.resolve(
      users.find((u) =>
        Object.entries(where).every(
          ([k, v]) => (u as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
    ),
  );
  const findOneOrFail = jest.fn((id: number) => {
    const found = users.find((u) => u.id === id);
    if (!found) throw new Error(`User ${id} not found`);
    return Promise.resolve(found);
  });
  const findAll = jest.fn().mockResolvedValue(users);
  return {
    create,
    findOne,
    findOneOrFail,
    findAll,
    getEntityManager: jest.fn(() => ({ persistAndFlush, flush })),
    persistAndFlush,
    flush,
  };
}

function createFakeSessionService() {
  return {
    create: jest.fn().mockResolvedValue('generated-token'),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService', () => {
  describe('register', () => {
    it('creates a pending moderator with a bcrypt-hashed password', async () => {
      const repo = createFakeUserRepository();
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await service.register('alice', 'hunter2');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'alice',
          role: 'moderator',
          status: 'pending',
        }),
      );
      const createdArgs = repo.create.mock.calls[0][0] as {
        passwordHash: string;
      };
      expect(createdArgs.passwordHash).not.toBe('hunter2');
      expect(repo.persistAndFlush).toHaveBeenCalled();
    });

    it('throws UsernameTakenError on a unique constraint violation', async () => {
      const repo = createFakeUserRepository();
      repo.persistAndFlush.mockRejectedValueOnce(
        new UniqueConstraintViolationException(new Error('duplicate')),
      );
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await expect(service.register('alice', 'hunter2')).rejects.toThrow(
        UsernameTakenError,
      );
    });
  });

  describe('login', () => {
    it('throws InvalidCredentialsError for an unknown username', async () => {
      const repo = createFakeUserRepository([]);
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await expect(service.login('nobody', 'pw')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('throws InvalidCredentialsError for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      const repo = createFakeUserRepository([
        {
          id: 1,
          username: 'alice',
          passwordHash,
          role: 'moderator',
          status: 'active',
        },
      ]);
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await expect(service.login('alice', 'wrong-password')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('throws AccountPendingError for a pending user with the right password', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      const repo = createFakeUserRepository([
        {
          id: 1,
          username: 'alice',
          passwordHash,
          role: 'moderator',
          status: 'pending',
        },
      ]);
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await expect(service.login('alice', 'hunter2')).rejects.toThrow(
        AccountPendingError,
      );
    });

    it('throws AccountDeactivatedError for a deactivated user', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      const repo = createFakeUserRepository([
        {
          id: 1,
          username: 'alice',
          passwordHash,
          role: 'moderator',
          status: 'deactivated',
        },
      ]);
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await expect(service.login('alice', 'hunter2')).rejects.toThrow(
        AccountDeactivatedError,
      );
    });

    it('returns a session token and AuthUser for a correct, active login', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      const repo = createFakeUserRepository([
        {
          id: 1,
          username: 'alice',
          passwordHash,
          role: 'admin',
          status: 'active',
        },
      ]);
      const sessions = createFakeSessionService();
      const service = new AuthService(
        repo as unknown as UserRepository,
        sessions as unknown as SessionService,
      );

      const result = await service.login('alice', 'hunter2');

      expect(result).toEqual({
        token: 'generated-token',
        user: { id: 1, username: 'alice', role: 'admin', status: 'active' },
      });
      expect(sessions.create).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the session token', async () => {
      const repo = createFakeUserRepository();
      const sessions = createFakeSessionService();
      const service = new AuthService(
        repo as unknown as UserRepository,
        sessions as unknown as SessionService,
      );

      await service.logout('some-token');

      expect(sessions.revoke).toHaveBeenCalledWith('some-token');
    });
  });

  describe('approve', () => {
    it('sets the role and marks the user active', async () => {
      const user: Partial<User> = {
        id: 5,
        username: 'bob',
        role: 'moderator',
        status: 'pending',
      };
      const repo = createFakeUserRepository([user]);
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      await service.approve(5, 'admin');

      expect(user.role).toBe('admin');
      expect(user.status).toBe('active');
      expect(repo.flush).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('marks the user deactivated and revokes their sessions', async () => {
      const user: Partial<User> = {
        id: 5,
        username: 'bob',
        role: 'moderator',
        status: 'active',
      };
      const repo = createFakeUserRepository([user]);
      const sessions = createFakeSessionService();
      const service = new AuthService(
        repo as unknown as UserRepository,
        sessions as unknown as SessionService,
      );

      await service.deactivate(5);

      expect(user.status).toBe('deactivated');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(5);
    });
  });

  describe('listUsers', () => {
    it('buckets users by status', async () => {
      const repo = createFakeUserRepository([
        {
          id: 1,
          username: 'p',
          role: 'moderator',
          status: 'pending',
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 2,
          username: 'a',
          role: 'admin',
          status: 'active',
          createdAt: new Date('2026-01-02'),
        },
        {
          id: 3,
          username: 'd',
          role: 'moderator',
          status: 'deactivated',
          createdAt: new Date('2026-01-03'),
        },
      ]);
      const service = new AuthService(
        repo as unknown as UserRepository,
        createFakeSessionService() as unknown as SessionService,
      );

      const result = await service.listUsers();

      expect(result.pending).toHaveLength(1);
      expect(result.active).toHaveLength(1);
      expect(result.deactivated).toHaveLength(1);
      expect(result.pending[0]).toEqual(
        expect.objectContaining({
          id: 1,
          username: 'p',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    });
  });
});
