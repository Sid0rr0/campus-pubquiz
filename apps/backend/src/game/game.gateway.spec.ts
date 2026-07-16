import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import type { TeamService } from '@/team/team.service';
import type { AnswerService } from '@/answer/answer.service';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/game-state.service';

const ADMIN_PASSWORD = 'test-admin-password';

const FIXTURE_SEEDED_GAME: SeededGame = {
  quizId: 'quiz-1',
  gameSessionId: 'session-1',
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 'round-1',
      breakAfter: false,
      questions: [{ id: 'r1q1', type: 'free_text', prompt: 'Q1', points: 1 }],
    },
  ],
};

function createFakeSeedService(): SeedService {
  return {
    seed: jest.fn().mockResolvedValue(FIXTURE_SEEDED_GAME),
  } as unknown as SeedService;
}

function createFakeTeamService() {
  return {
    join: jest.fn().mockResolvedValue({
      id: 'team-1',
      name: 'The Quizzards',
      token: 'team-token-1',
    }),
  };
}

type MockTeamService = ReturnType<typeof createFakeTeamService>;

function asTeamService(mock: MockTeamService): TeamService {
  return mock as unknown as TeamService;
}

function createFakeAnswerService() {
  return {
    submit: jest.fn().mockResolvedValue({
      answerId: 'answer-1',
      teamId: 'team-1',
      teamName: 'The Quizzards',
      value: 'Banana',
    }),
    listForQuestion: jest.fn().mockResolvedValue([
      {
        answerId: 'answer-1',
        teamId: 'team-1',
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: null,
      },
    ]),
  };
}

type MockAnswerService = ReturnType<typeof createFakeAnswerService>;

function asAnswerService(mock: MockAnswerService): AnswerService {
  return mock as unknown as AnswerService;
}

function createMockSocket(role?: string, auth: Record<string, string> = {}) {
  const rooms = new Set<string>();
  return {
    id: 'socket-1',
    handshake: { query: role === undefined ? {} : { role }, auth },
    join: jest.fn((room: string) => rooms.add(room)),
    rooms,
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

type MockSocket = ReturnType<typeof createMockSocket>;

function asSocket(mock: MockSocket): Socket {
  return mock as unknown as Socket;
}

function createMockServer() {
  const to = jest.fn();
  const server = { to, emit: jest.fn() };
  to.mockReturnValue(server);
  return server;
}

type MockServer = ReturnType<typeof createMockServer>;

function asServer(mock: MockServer): Server {
  return mock as unknown as Server;
}

describe('GameGateway', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let teamService: MockTeamService;
  let answerService: MockAnswerService;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;

  beforeAll(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = originalAdminPassword;
  });

  beforeEach(async () => {
    const gameStateService = new GameStateService(createFakeSeedService());
    await gameStateService.onModuleInit();
    teamService = createFakeTeamService();
    answerService = createFakeAnswerService();
    gateway = new GameGateway(
      gameStateService,
      asTeamService(teamService),
      asAnswerService(answerService),
    );
    server = createMockServer();
    gateway.server = asServer(server);
  });

  it('joins a connecting display client to the display room and sends a state snapshot', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(client));

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'lobby' }),
      }),
    );
  });

  it('disconnects a client that connects without a recognized role', async () => {
    const client = createMockSocket('not-a-real-room');
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with no role at all', async () => {
    const client = createMockSocket();
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('joins an admin client that presents the correct password', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(admin.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an admin client with the wrong password', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: 'wrong-password',
    });
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('disconnects an admin client with no password at all', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('applies an admin action and broadcasts the updated snapshot to all three rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'question_open' }),
      }),
    );
  });

  it('rejects an admin action from a non-admin client without broadcasting', async () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(display));

    expect(() =>
      gateway.handleAdminAction(asSocket(display), { action: 'START_QUIZ' }),
    ).toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('propagates an illegal-transition error for an out-of-order admin action without broadcasting', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    // LOCK_ANSWERS is illegal from lobby - quiz hasn't started yet
    expect(() =>
      gateway.handleAdminAction(asSocket(admin), { action: 'LOCK_ANSWERS' }),
    ).toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('joins a team and emits JOIN_ACCEPTED for a players-room client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });

    expect(teamService.join).toHaveBeenCalledWith(
      'session-1',
      'The Quizzards',
      undefined,
    );
    expect(player.emit).toHaveBeenCalledWith(SOCKET_EVENTS.JOIN_ACCEPTED, {
      teamId: 'team-1',
      teamName: 'The Quizzards',
      teamToken: 'team-token-1',
    });
  });

  it('rejects JOIN_PLAYERS from a non-players client', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleJoinPlayers(asSocket(admin), { teamName: 'The Quizzards' }),
    ).rejects.toThrow(WsException);
  });

  it('surfaces a team-join error (e.g. name taken) as a WsException', async () => {
    teamService.join.mockRejectedValueOnce(
      new Error('Team name "The Quizzards" is already taken in this session'),
    );
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleJoinPlayers(asSocket(player), {
        teamName: 'The Quizzards',
      }),
    ).rejects.toThrow(WsException);
  });

  it('submits an answer and broadcasts ANSWERS_UPDATED to the admin room only', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 'r1q1',
      teamId: 'team-1',
      value: 'Banana',
    });

    expect(answerService.submit).toHaveBeenCalledWith(
      'session-1',
      'r1q1',
      'team-1',
      'Banana',
    );
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId: 'r1q1',
      answers: [
        {
          answerId: 'answer-1',
          teamId: 'team-1',
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: null,
        },
      ],
    });
  });

  it('acknowledges the submitting player with ANSWER_RECEIVED', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 'r1q1',
      teamId: 'team-1',
      value: 'Banana',
    });

    expect(player.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWER_RECEIVED, {
      questionId: 'r1q1',
      teamId: 'team-1',
      teamName: 'The Quizzards',
      value: 'Banana',
    });
  });

  it('rejects SUBMIT_ANSWER from a non-players client', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleSubmitAnswer(asSocket(admin), {
        questionId: 'r1q1',
        teamId: 'team-1',
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });
});
