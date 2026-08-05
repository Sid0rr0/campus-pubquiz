import { MikroORM } from '@mikro-orm/core';
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_ROOMS,
  type AuthUser,
  type GameProgress,
} from '@campus-pubquiz/types';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import type { SessionService } from '@/auth/session.service';
import type { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import type { TeamService } from '@/team/team.service';
import type { AnswerService } from '@/answer/answer.service';
import type { BonusService } from '@/bonus/bonus.service';
import type { GameProgressRepository } from '@/game/game-progress.repository';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/game-state.service';

// GameStateService.onModuleInit and every DB-touching GameGateway handler
// are wrapped in @CreateRequestContext(), which requires a real MikroORM
// instance (checked via `instanceof`) — these tests mock the DB-touching
// services entirely, so a prototype-only fake with a working em.fork() is
// enough to satisfy the decorator without a real DB.
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

export const FIXTURE_SEEDED_GAME: SeededGame = {
  quizId: 1,
  gameSessionId: 101,
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 11,
      title: 'Round 1',
      breakAfter: false,
      questions: [
        {
          id: 21,
          type: 'free_text',
          prompt: 'Q1',
          points: 1,
          answer: 'A1',
        },
      ],
    },
  ],
};

export const IMPORTED_QUIZ_GAME: SeededGame = {
  quizId: 2,
  gameSessionId: 102,
  joinCode: 'GHIJKL',
  rounds: [
    {
      id: 13,
      title: 'Imported Round',
      breakAfter: true,
      questions: [
        {
          id: 25,
          type: 'free_text',
          prompt: 'Imported question',
          points: 1,
          answer: 'Imported answer',
        },
      ],
    },
  ],
};

export function createFakeSeedService() {
  return {
    seed: jest.fn().mockResolvedValue(FIXTURE_SEEDED_GAME),
    loadGame: jest.fn().mockResolvedValue(IMPORTED_QUIZ_GAME),
    createSession: jest
      .fn()
      .mockResolvedValue({ gameSessionId: 102, joinCode: 'GHIJKL' }),
  };
}

export type MockSeedService = ReturnType<typeof createFakeSeedService>;

export function asSeedService(mock: MockSeedService): SeedService {
  return mock as unknown as SeedService;
}

// game-state.service.spec.ts exercises richer game-structure behavior (round
// summaries, block questions, reveal paging) that FIXTURE_SEEDED_GAME above
// is too small to cover, so it gets its own two-round/four-question fixture.
export const GAME_STATE_FIXTURE_SEEDED_GAME: SeededGame = {
  quizId: 1,
  gameSessionId: 101,
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 11,
      title: 'General Knowledge',
      breakAfter: false,
      questions: [
        {
          id: 21,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          points: 2,
          answer: 'Paris',
        },
        {
          id: 22,
          type: 'free_text',
          prompt: 'Name the largest planet in the solar system.',
          points: 2,
          answer: 'Jupiter',
        },
      ],
    },
    {
      id: 12,
      title: 'Landmarks & Flags',
      breakAfter: true,
      questions: [
        {
          id: 23,
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          points: 3,
          answer: 'Eiffel Tower',
        },
        {
          id: 24,
          type: 'free_text',
          prompt: 'Name this flag.',
          points: 3,
          answer: 'France',
          answerMediaUrl: 'https://example.com/france-flag.jpg',
        },
      ],
    },
  ],
};

/** Same shape as createFakeSeedService, but seeded with GAME_STATE_FIXTURE_SEEDED_GAME
 * for game-state.service.spec.ts's richer round-structure tests. */
export function createFakeGameStateSeedService() {
  return {
    seed: jest.fn().mockResolvedValue(GAME_STATE_FIXTURE_SEEDED_GAME),
    loadGame: jest.fn().mockResolvedValue(IMPORTED_QUIZ_GAME),
    createSession: jest
      .fn()
      .mockResolvedValue({ gameSessionId: 102, joinCode: 'GHIJKL' }),
  };
}

export function createFakeGameProgressRepository(
  initial: GameProgress | null = null,
) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(initial),
  };
}

export type MockGameProgressRepository = ReturnType<
  typeof createFakeGameProgressRepository
>;

export function asGameProgressRepository(
  mock: MockGameProgressRepository,
): GameProgressRepository {
  return mock as unknown as GameProgressRepository;
}

export function createFakeTeamService() {
  return {
    join: jest.fn().mockResolvedValue({
      id: 31,
      name: 'The Quizzards',
      token: 'team-token-1',
      code: 'team-code-1',
    }),
    listForSession: jest
      .fn()
      .mockResolvedValue([{ teamId: 31, teamName: 'The Quizzards' }]),
  };
}

export type MockTeamService = ReturnType<typeof createFakeTeamService>;

export function asTeamService(mock: MockTeamService): TeamService {
  return mock as unknown as TeamService;
}

export function createFakeAnswerService() {
  return {
    submit: jest.fn().mockResolvedValue({
      answerId: 41,
      teamId: 31,
      teamName: 'The Quizzards',
      value: 'Banana',
    }),
    listForQuestion: jest.fn().mockResolvedValue([
      {
        answerId: 41,
        teamId: 31,
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: 0,
        gradedAt: null,
      },
    ]),
    listForTeam: jest
      .fn()
      .mockResolvedValue([{ questionId: 21, value: 'Banana' }]),
    grade: jest.fn().mockResolvedValue({ questionId: 21 }),
    computeLeaderboard: jest.fn().mockResolvedValue([
      {
        teamId: 31,
        teamName: 'The Quizzards',
        totalPoints: 2,
        bonusPoints: 0,
      },
    ]),
  };
}

export type MockAnswerService = ReturnType<typeof createFakeAnswerService>;

export function asAnswerService(mock: MockAnswerService): AnswerService {
  return mock as unknown as AnswerService;
}

export function createFakeBonusService() {
  return {
    award: jest.fn().mockResolvedValue({ teamId: 31 }),
  };
}

export type MockBonusService = ReturnType<typeof createFakeBonusService>;

export function asBonusService(mock: MockBonusService): BonusService {
  return mock as unknown as BonusService;
}

export function createMockSocket(
  role?: string,
  auth: Record<string, string> = {},
  id = 'socket-1',
  code?: string,
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
        ...(code === undefined ? {} : { code }),
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

/** Connects a players-room socket the way a real client would, and registers
 * it in the mock server's socket registry so presence/kick lookups can find it. */
export async function connectPlayer(
  gateway: GameGateway,
  server: MockServer,
  id: string,
): Promise<MockSocket> {
  const socket = createMockSocket(SOCKET_ROOMS.PLAYERS, {}, id);
  await gateway.handleConnection(asSocket(socket));
  server.sockets.sockets.set(id, socket);
  return socket;
}

export interface TestGateway {
  gateway: GameGateway;
  server: MockServer;
  teamService: MockTeamService;
  answerService: MockAnswerService;
  bonusService: MockBonusService;
  seedService: MockSeedService;
  sessionService: MockSessionService;
}

/** Builds a GameGateway wired to fresh fake services/mock server, seeded with
 * FIXTURE_SEEDED_GAME (game session 101, join code ABCDEF, round 1 / q21). */
export async function createTestGateway(): Promise<TestGateway> {
  const seedService = createFakeSeedService();
  const gameStateService = new GameStateService(
    asSeedService(seedService),
    asGameProgressRepository(createFakeGameProgressRepository()),
    createFakeOrm(),
  );
  await gameStateService.onModuleInit();
  const teamService = createFakeTeamService();
  const answerService = createFakeAnswerService();
  const bonusService = createFakeBonusService();
  const sessionService = createFakeSessionService();
  const gateway = new GameGateway(
    gameStateService,
    asTeamService(teamService),
    asAnswerService(answerService),
    asBonusService(bonusService),
    asSessionService(sessionService),
    createFakeOrm(),
  );
  const server = createMockServer();
  gateway.server = asServer(server);
  return {
    gateway,
    server,
    teamService,
    answerService,
    bonusService,
    seedService,
    sessionService,
  };
}

/** Opens r1q1 via an admin START_QUIZ + ADVANCE past the rules screen and round intro card, then clears broadcast bookkeeping. */
export async function openFirstQuestion(
  gateway: GameGateway,
  server: MockServer,
): Promise<void> {
  const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
    token: TEST_SESSION_TOKEN,
  });
  await gateway.handleConnection(asSocket(admin));
  await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });
  await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> round_intro(0)
  await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> r1q1
  server.to.mockClear();
  server.emit.mockClear();
}
