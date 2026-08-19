import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from '@/auth/roles.guard';
import type { AuthUser } from '@campus-pubquiz/types';

function createContext(user: AuthUser | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no @Roles metadata is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = createContext({
      id: 1,
      username: 'alice',
      role: 'moderator',
      status: 'active',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a moderator when @Roles("admin") is declared', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = createContext({
      id: 1,
      username: 'alice',
      role: 'moderator',
      status: 'active',
    });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows an admin when @Roles("admin") is declared', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = createContext({
      id: 1,
      username: 'alice',
      role: 'admin',
      status: 'active',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when no user is present on the request', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = createContext(undefined);

    expect(guard.canActivate(context)).toBe(false);
  });
});
