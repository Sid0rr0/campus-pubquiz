import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { SessionGuard } from '@/auth/session.guard';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import type { SessionService } from '@/auth/session.service';
import type { AuthUser } from '@campus-pubquiz/types';

function createContext(
  cookies: Record<string, string | undefined>,
  request: Record<string, unknown> = {},
) {
  Object.assign(request, { cookies });
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  const authUser: AuthUser = {
    id: 1,
    username: 'alice',
    role: 'moderator',
    status: 'active',
  };

  it('throws UnauthorizedException when the session cookie is missing', async () => {
    const sessions = { validate: jest.fn() };
    const guard = new SessionGuard(sessions as unknown as SessionService);
    const context = createContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the token fails validation', async () => {
    const sessions = { validate: jest.fn().mockResolvedValue(null) };
    const guard = new SessionGuard(sessions as unknown as SessionService);
    const context = createContext({ [SESSION_COOKIE_NAME]: 'bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.validate).toHaveBeenCalledWith('bad-token');
  });

  it('sets request.user and returns true for a valid token', async () => {
    const sessions = {
      validate: jest.fn().mockResolvedValue({ user: authUser }),
    };
    const guard = new SessionGuard(sessions as unknown as SessionService);
    const request: Record<string, unknown> = {};
    const context = createContext(
      { [SESSION_COOKIE_NAME]: 'good-token' },
      request,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(authUser);
  });
});
