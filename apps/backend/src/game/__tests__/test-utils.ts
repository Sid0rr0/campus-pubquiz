import { MikroORM } from '@mikro-orm/core';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '@campus-pubquiz/types';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import type { SessionService } from '@/auth/session.service';

// Services wrapped in @CreateRequestContext() require a real MikroORM
// instance (checked via `instanceof`) — a prototype-only fake with a working
// em.fork() satisfies the decorator for specs that mock the DB-touching
// services entirely.
export function createFakeOrm(): MikroORM {
  const em = { name: 'default', fork: () => em };
  return Object.assign(Object.create(MikroORM.prototype) as MikroORM, { em });
}

export const TEST_SESSION_TOKEN = 'test-session-token';

export const TEST_ADMIN_USER: AuthUser = {
  id: 1,
  username: 'test-admin',
  role: 'admin',
  status: 'active',
};

export const TEST_MODERATOR_USER: AuthUser = {
  id: 2,
  username: 'test-moderator',
  role: 'moderator',
  status: 'active',
};

/** Validates TEST_SESSION_TOKEN as an admin by default; pass a different
 * token->user map (e.g. { [TEST_SESSION_TOKEN]: TEST_MODERATOR_USER }) to
 * test moderator admission, or {} to test rejection of an unknown token. */
export function createFakeSessionService(
  validTokens: Record<string, AuthUser> = {
    [TEST_SESSION_TOKEN]: TEST_ADMIN_USER,
  },
) {
  return {
    validate: jest.fn((token: string | undefined) =>
      Promise.resolve(
        typeof token === 'string' && token in validTokens
          ? { user: validTokens[token] }
          : null,
      ),
    ),
  };
}

export type MockSessionService = ReturnType<typeof createFakeSessionService>;

export function asSessionService(mock: MockSessionService): SessionService {
  return mock as unknown as SessionService;
}

export function createMockSocket(
  role?: string,
  auth: Record<string, string> = {},
  id = 'socket-1',
  // Join code of the session to connect to: pass the real-store harness's
  // `joinCode` (or another session's). Pass `null` explicitly (rather than
  // omitting) to simulate a handshake with no `?code=` at all.
  code: string | null = 'ABCDEF',
) {
  const rooms = new Set<string>();
  const cookie = auth.token
    ? `${SESSION_COOKIE_NAME}=${auth.token}`
    : undefined;
  const socket = {
    id,
    handshake: {
      query: {
        ...(role === undefined ? {} : { role }),
        ...(code === null ? {} : { code }),
      },
      headers: { cookie },
    },
    join: jest.fn((room: string) => rooms.add(room)),
    leave: jest.fn((room: string) => rooms.delete(room)),
    rooms,
    data: {} as Record<string, unknown>,
    emit: jest.fn(),
    connected: true,
    disconnect: jest.fn(),
  };
  socket.disconnect.mockImplementation(() => {
    socket.connected = false;
  });
  return socket;
}

export type MockSocket = ReturnType<typeof createMockSocket>;

export function asSocket(mock: MockSocket): Socket {
  return mock as unknown as Socket;
}

export function createMockServer() {
  const to = jest.fn();
  const socketsById = new Map<string, MockSocket>();
  const server = {
    to,
    emit: jest.fn(),
    sockets: { sockets: socketsById },
  };
  to.mockReturnValue(server);
  return server;
}

export type MockServer = ReturnType<typeof createMockServer>;

export function asServer(mock: MockServer): Server {
  return mock as unknown as Server;
}
