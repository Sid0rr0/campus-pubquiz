import * as bcrypt from 'bcryptjs';
import { MikroORM } from '@mikro-orm/core';
import { AuthBootstrapService } from '@/auth/auth-bootstrap.service';
import type { UserRepository } from '@/db/repositories/user.repository';
import type { User } from '@/db/entities/user.entity';

// onModuleInit is wrapped in @CreateRequestContext(), which requires a real
// MikroORM instance (checked via `instanceof`) — a prototype-only fake with
// a working em.fork() satisfies the decorator without a real DB.
function createFakeOrm(): MikroORM {
  const em = { name: 'default', fork: () => em };
  return Object.assign(Object.create(MikroORM.prototype) as MikroORM, { em });
}

function createFakeUserRepository(users: Partial<User>[]) {
  const flush = jest.fn().mockResolvedValue(undefined);
  const create = jest.fn((data: Record<string, unknown>) => {
    const created = { ...data };
    users.push(created);
    return created;
  });
  const findOne = jest.fn((where: Record<string, unknown>) =>
    Promise.resolve(
      users.find((u) =>
        Object.entries(where).every(
          ([k, v]) => (u as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
    ),
  );
  return {
    create,
    findOne,
    getEntityManager: jest.fn(() => ({ flush })),
    flush,
  };
}

describe('AuthBootstrapService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does nothing when an admin already exists, regardless of env vars', async () => {
    process.env = {
      ...originalEnv,
      BOOTSTRAP_ADMIN_USERNAME: 'root',
      BOOTSTRAP_ADMIN_PASSWORD: 'pw',
    };
    const users: Partial<User>[] = [
      { id: 1, username: 'existing-admin', role: 'admin', status: 'active' },
    ];
    const repo = createFakeUserRepository(users);
    const service = new AuthBootstrapService(
      repo as unknown as UserRepository,
      createFakeOrm(),
    );

    await service.onModuleInit();

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('warns and no-ops when no admin exists and env vars are unset', async () => {
    process.env = {
      ...originalEnv,
      BOOTSTRAP_ADMIN_USERNAME: undefined,
      BOOTSTRAP_ADMIN_PASSWORD: undefined,
    };
    const repo = createFakeUserRepository([]);
    const service = new AuthBootstrapService(
      repo as unknown as UserRepository,
      createFakeOrm(),
    );

    await service.onModuleInit();

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates an active admin from env vars when no admin exists and the username is new', async () => {
    process.env = {
      ...originalEnv,
      BOOTSTRAP_ADMIN_USERNAME: 'root',
      BOOTSTRAP_ADMIN_PASSWORD: 'plain-pw',
    };
    const repo = createFakeUserRepository([]);
    const service = new AuthBootstrapService(
      repo as unknown as UserRepository,
      createFakeOrm(),
    );

    await service.onModuleInit();

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'root',
        role: 'admin',
        status: 'active',
      }),
    );
    const createdArgs = repo.create.mock.calls[0][0] as {
      passwordHash: string;
    };
    expect(await bcrypt.compare('plain-pw', createdArgs.passwordHash)).toBe(
      true,
    );
  });

  it('promotes an existing non-admin user with a matching username instead of creating a new row', async () => {
    process.env = {
      ...originalEnv,
      BOOTSTRAP_ADMIN_USERNAME: 'root',
      BOOTSTRAP_ADMIN_PASSWORD: 'plain-pw',
    };
    const existing: Partial<User> = {
      id: 3,
      username: 'root',
      role: 'moderator',
      status: 'pending',
    };
    const repo = createFakeUserRepository([existing]);
    const service = new AuthBootstrapService(
      repo as unknown as UserRepository,
      createFakeOrm(),
    );

    await service.onModuleInit();

    expect(repo.create).not.toHaveBeenCalled();
    expect(existing.role).toBe('admin');
    expect(existing.status).toBe('active');
    expect(repo.flush).toHaveBeenCalled();
  });
});
