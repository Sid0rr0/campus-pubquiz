import { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { MikroORM } from '@mikro-orm/core';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import type { TeamService } from '@/team/team.service';
import type { AnswerService } from '@/answer/answer.service';
import type { GameProgressRepository } from '@/game/game-progress.repository';
import type { QuizService } from '@/quiz/quiz.service';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/game-state.service';

// GameStateService.onModuleInit and every DB-touching GameGateway handler
// are wrapped in @CreateRequestContext(), which requires a real MikroORM
// instance (checked via `instanceof`) — these tests mock the DB-touching
// services entirely, so a prototype-only fake with a working em.fork() is
// enough to satisfy the decorator without a real DB.
function createFakeOrm(): MikroORM {
  const em = { name: 'default', fork: () => em };
  return Object.assign(Object.create(MikroORM.prototype) as MikroORM, { em });
}

const ADMIN_PASSWORD = 'test-admin-password';

const FIXTURE_SEEDED_GAME: SeededGame = {
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

const IMPORTED_QUIZ_GAME: SeededGame = {
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

function createFakeSeedService() {
  return {
    seed: jest.fn().mockResolvedValue(FIXTURE_SEEDED_GAME),
    loadGame: jest.fn().mockResolvedValue(IMPORTED_QUIZ_GAME),
    createSession: jest
      .fn()
      .mockResolvedValue({ gameSessionId: 102, joinCode: 'GHIJKL' }),
  };
}

type MockSeedService = ReturnType<typeof createFakeSeedService>;

function asSeedService(mock: MockSeedService): SeedService {
  return mock as unknown as SeedService;
}

function createFakeQuizService() {
  return {
    list: jest.fn().mockResolvedValue([
      { id: 1, title: 'Campus Pub Quiz Night', rounds: [] },
      { id: 2, title: 'Imported Quiz', rounds: [] },
    ]),
  };
}

type MockQuizService = ReturnType<typeof createFakeQuizService>;

function asQuizService(mock: MockQuizService): QuizService {
  return mock as unknown as QuizService;
}

function createFakeGameProgressRepository() {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(null),
  };
}

type MockGameProgressRepository = ReturnType<
  typeof createFakeGameProgressRepository
>;

function asGameProgressRepository(
  mock: MockGameProgressRepository,
): GameProgressRepository {
  return mock as unknown as GameProgressRepository;
}

function createFakeTeamService() {
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

type MockTeamService = ReturnType<typeof createFakeTeamService>;

function asTeamService(mock: MockTeamService): TeamService {
  return mock as unknown as TeamService;
}

function createFakeAnswerService() {
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
    computeLeaderboard: jest
      .fn()
      .mockResolvedValue([
        { teamId: 31, teamName: 'The Quizzards', totalPoints: 2 },
      ]),
  };
}

type MockAnswerService = ReturnType<typeof createFakeAnswerService>;

function asAnswerService(mock: MockAnswerService): AnswerService {
  return mock as unknown as AnswerService;
}

function createMockSocket(
  role?: string,
  auth: Record<string, string> = {},
  id = 'socket-1',
) {
  const rooms = new Set<string>();
  const socket = {
    id,
    handshake: { query: role === undefined ? {} : { role }, auth },
    join: jest.fn((room: string) => rooms.add(room)),
    rooms,
    emit: jest.fn(),
    connected: true,
    disconnect: jest.fn(),
  };
  socket.disconnect.mockImplementation(() => {
    socket.connected = false;
  });
  return socket;
}

type MockSocket = ReturnType<typeof createMockSocket>;

function asSocket(mock: MockSocket): Socket {
  return mock as unknown as Socket;
}

function createMockServer() {
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

type MockServer = ReturnType<typeof createMockServer>;

function asServer(mock: MockServer): Server {
  return mock as unknown as Server;
}

/** Connects a players-room socket the way a real client would, and registers
 * it in the mock server's socket registry so presence/kick lookups can find it. */
async function connectPlayer(
  gateway: GameGateway,
  server: MockServer,
  id: string,
): Promise<MockSocket> {
  const socket = createMockSocket(SOCKET_ROOMS.PLAYERS, {}, id);
  await gateway.handleConnection(asSocket(socket));
  server.sockets.sockets.set(id, socket);
  return socket;
}

describe('GameGateway', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let teamService: MockTeamService;
  let answerService: MockAnswerService;
  let quizService: MockQuizService;
  let seedService: MockSeedService;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;

  /** Opens r1q1 via an admin START_QUIZ + ADVANCE past the rules screen, then clears broadcast bookkeeping. */
  async function openFirstQuestion() {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' });
    server.to.mockClear();
    server.emit.mockClear();
  }

  beforeAll(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = originalAdminPassword;
  });

  beforeEach(async () => {
    quizService = createFakeQuizService();
    seedService = createFakeSeedService();
    const gameStateService = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await gameStateService.onModuleInit();
    teamService = createFakeTeamService();
    answerService = createFakeAnswerService();
    gateway = new GameGateway(
      gameStateService,
      asTeamService(teamService),
      asAnswerService(answerService),
      asQuizService(quizService),
      createFakeOrm(),
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

  it('includes the session join code in the snapshot sent on connection', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(client));

    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({ joinCode: 'ABCDEF' }),
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
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid admin password',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('disconnects an admin client with no password at all', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid admin password',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('applies an admin action and broadcasts the updated snapshot to all three rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'rules' }),
      }),
    );
  });

  it('rejects an admin action from a non-admin client without broadcasting', async () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(display));

    await expect(
      gateway.handleAdminAction(asSocket(display), { action: 'START_QUIZ' }),
    ).rejects.toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('propagates an illegal-transition error for an out-of-order admin action without broadcasting', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    // ADVANCE is illegal from lobby - quiz hasn't started yet
    await expect(
      gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }),
    ).rejects.toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('joins a team and emits JOIN_ACCEPTED for a players-room client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });

    expect(teamService.join).toHaveBeenCalledWith(101, 'The Quizzards', {
      teamToken: undefined,
      teamCode: undefined,
      joinCode: 'ABCDEF',
    });
    expect(player.emit).toHaveBeenCalledWith(SOCKET_EVENTS.JOIN_ACCEPTED, {
      teamId: 31,
      teamName: 'The Quizzards',
      teamToken: 'team-token-1',
      teamCode: 'team-code-1',
      answers: [{ questionId: 21, value: 'Banana' }],
    });
    expect(answerService.listForTeam).toHaveBeenCalledWith(101, 31);
  });

  it('passes the team code through to TeamService.join when the player supplies one', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
      teamCode: 'RECOVER1',
    });

    expect(teamService.join).toHaveBeenCalledWith(101, 'The Quizzards', {
      teamToken: undefined,
      teamCode: 'RECOVER1',
      joinCode: 'ABCDEF',
    });
  });

  it('broadcasts the updated connected-team list to all rooms after a join', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });

    expect(teamService.listForSession).toHaveBeenCalledWith(101);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        teams: [{ teamId: 31, teamName: 'The Quizzards', isConnected: true }],
      }),
    );
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

  it('submits an answer and broadcasts ANSWERS_UPDATED to the admin room', async () => {
    await openFirstQuestion();
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(answerService.submit).toHaveBeenCalledWith(101, 21, 31, 'Banana');
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId: 21,
      question: {
        type: 'free_text',
        prompt: 'Q1',
        points: 1,
        correctAnswer: 'A1',
        roundTitle: 'Round 1',
        roundNumber: 1,
        questionNumberInRound: 1,
        totalQuestionsInRound: 1,
      },
      answers: [
        {
          answerId: 41,
          teamId: 31,
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ],
    });
  });

  it('acknowledges the submitting player with ANSWER_RECEIVED', async () => {
    await openFirstQuestion();
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(player.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWER_RECEIVED, {
      questionId: 21,
      teamId: 31,
      teamName: 'The Quizzards',
      value: 'Banana',
    });
  });

  it('broadcasts STATE_UPDATED with the answered team ids after a submit', async () => {
    await openFirstQuestion();
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({ answeredTeamIds: [31] }),
    );
  });

  it('rejects SUBMIT_ANSWER while the question is not open for answering', async () => {
    // Still in the lobby - no question has been revealed yet.
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSubmitAnswer(asSocket(player), {
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });

  it('rejects SUBMIT_ANSWER from a non-players client', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleSubmitAnswer(asSocket(admin), {
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });

  it('grades an answer and broadcasts ANSWERS_UPDATED to the admin room', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleGradeAnswer(asSocket(admin), {
      answerId: 41,
      pointsAwarded: 2,
    });

    expect(answerService.grade).toHaveBeenCalledWith(41, 2);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId: 21,
      question: {
        type: 'free_text',
        prompt: 'Q1',
        points: 1,
        correctAnswer: 'A1',
        roundTitle: 'Round 1',
        roundNumber: 1,
        questionNumberInRound: 1,
        totalQuestionsInRound: 1,
      },
      answers: [
        {
          answerId: 41,
          teamId: 31,
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ],
    });
  });

  it('refreshes the leaderboard and broadcasts STATE_UPDATED to all three rooms after grading', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleGradeAnswer(asSocket(admin), {
      answerId: 41,
      pointsAwarded: 2,
    });

    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        leaderboard: [
          { teamId: 31, teamName: 'The Quizzards', totalPoints: 2 },
        ],
      }),
    );
  });

  it('rejects GRADE_ANSWER from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleGradeAnswer(asSocket(player), {
        answerId: 41,
        pointsAwarded: 2,
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.grade).not.toHaveBeenCalled();
  });

  it('lists quizzes with the active quiz id for an admin client', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleListQuizzes(asSocket(admin));

    expect(admin.emit).toHaveBeenCalledWith(SOCKET_EVENTS.QUIZZES_LISTED, {
      activeQuizId: 1,
      quizzes: [
        { id: 1, title: 'Campus Pub Quiz Night', rounds: [] },
        { id: 2, title: 'Imported Quiz', rounds: [] },
      ],
    });
  });

  it('rejects LIST_QUIZZES from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(gateway.handleListQuizzes(asSocket(player))).rejects.toThrow(
      WsException,
    );
    expect(quizService.list).not.toHaveBeenCalled();
  });

  it('selects a quiz and broadcasts the reset snapshot to all three rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleSelectQuiz(asSocket(admin), { quizId: 2 });

    expect(seedService.createSession).toHaveBeenCalledWith(2);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'lobby' }),
      }),
    );
  });

  it('lists answers for a requested block question to the requesting admin only', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleListAnswers(asSocket(admin), { questionId: 21 });

    expect(answerService.listForQuestion).toHaveBeenCalledWith(101, 21);
    expect(admin.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId: 21,
      question: {
        type: 'free_text',
        prompt: 'Q1',
        points: 1,
        correctAnswer: 'A1',
        roundTitle: 'Round 1',
        roundNumber: 1,
        questionNumberInRound: 1,
        totalQuestionsInRound: 1,
      },
      answers: [
        {
          answerId: 41,
          teamId: 31,
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ],
    });
  });

  it('rejects LIST_ANSWERS from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleListAnswers(asSocket(player), { questionId: 21 }),
    ).rejects.toThrow(WsException);
    expect(answerService.listForQuestion).not.toHaveBeenCalled();
  });

  it('rejects SELECT_QUIZ from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSelectQuiz(asSocket(player), { quizId: 2 }),
    ).rejects.toThrow(WsException);
    expect(seedService.createSession).not.toHaveBeenCalled();
  });

  describe('socket event logging', () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('logs a successful connection with the socket id and role', async () => {
      const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
      await gateway.handleConnection(asSocket(display));

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('socket-1'));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_ROOMS.DISPLAY),
      );
    });

    it('warns when a connection is rejected for an unrecognized role', async () => {
      const client = createMockSocket('not-a-real-room');
      await gateway.handleConnection(asSocket(client));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not-a-real-room'),
      );
    });

    it('warns when an admin connection is rejected for a bad password', async () => {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: 'wrong-password',
      });
      await gateway.handleConnection(asSocket(admin));

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('password'));
    });

    it('logs an ADMIN_ACTION event with the action name', async () => {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      await gateway.handleAdminAction(asSocket(admin), {
        action: 'START_QUIZ',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_EVENTS.ADMIN_ACTION),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('START_QUIZ'),
      );
    });

    it('logs a JOIN_PLAYERS event with the team name', async () => {
      const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
      await gateway.handleConnection(asSocket(player));

      await gateway.handleJoinPlayers(asSocket(player), {
        teamName: 'The Quizzards',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_EVENTS.JOIN_PLAYERS),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('The Quizzards'),
      );
    });

    it('logs a SUBMIT_ANSWER event with the question and team ids', async () => {
      await openFirstQuestion();
      const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
      await gateway.handleConnection(asSocket(player));

      await gateway.handleSubmitAnswer(asSocket(player), {
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_EVENTS.SUBMIT_ANSWER),
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('21'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('31'));
    });

    it('logs a GRADE_ANSWER event with the answer id and points', async () => {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      await gateway.handleGradeAnswer(asSocket(admin), {
        answerId: 41,
        pointsAwarded: 2,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_EVENTS.GRADE_ANSWER),
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('41'));
    });

    it('logs a LIST_QUIZZES event', async () => {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      await gateway.handleListQuizzes(asSocket(admin));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_EVENTS.LIST_QUIZZES),
      );
    });

    it('logs a SELECT_QUIZ event with the quiz id', async () => {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      await gateway.handleSelectQuiz(asSocket(admin), { quizId: 2 });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(SOCKET_EVENTS.SELECT_QUIZ),
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
    });
  });

  it('surfaces a mid-game quiz selection as a WsException', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    await expect(
      gateway.handleSelectQuiz(asSocket(admin), { quizId: 2 }),
    ).rejects.toThrow(WsException);
    expect(seedService.createSession).not.toHaveBeenCalled();
  });

  describe('one live connection per team + admin kick', () => {
    async function joinAsPlayer(id: string) {
      const player = await connectPlayer(gateway, server, id);
      await gateway.handleJoinPlayers(asSocket(player), {
        teamName: 'The Quizzards',
        joinCode: 'ABCDEF',
      });
      return player;
    }

    it('rejects a second device joining the same team while the first is still connected', async () => {
      await joinAsPlayer('socket-a');
      const playerB = await connectPlayer(gateway, server, 'socket-b');

      await expect(
        gateway.handleJoinPlayers(asSocket(playerB), {
          teamName: 'The Quizzards',
          joinCode: 'ABCDEF',
        }),
      ).rejects.toThrow(/already connected/i);
    });

    it('allows the same still-connected socket to re-join the team it already holds', async () => {
      const playerA = await joinAsPlayer('socket-a');

      await expect(
        gateway.handleJoinPlayers(asSocket(playerA), {
          teamName: 'The Quizzards',
          joinCode: 'ABCDEF',
        }),
      ).resolves.toBeUndefined();
    });

    it('allows a new device to join once the previous device disconnects', async () => {
      const playerA = await joinAsPlayer('socket-a');
      gateway.handleDisconnect(asSocket(playerA));
      const playerB = await connectPlayer(gateway, server, 'socket-b');

      await expect(
        gateway.handleJoinPlayers(asSocket(playerB), {
          teamName: 'The Quizzards',
          joinCode: 'ABCDEF',
        }),
      ).resolves.toBeUndefined();
    });

    it('allows a new device to join when the previous socket is stale (disconnect event has not fired yet)', async () => {
      const playerA = await joinAsPlayer('socket-a');
      // Simulate the transport already having dropped without our
      // handleDisconnect hook having run yet (e.g. a page-refresh race).
      playerA.connected = false;
      const playerB = await connectPlayer(gateway, server, 'socket-b');

      await expect(
        gateway.handleJoinPlayers(asSocket(playerB), {
          teamName: 'The Quizzards',
          joinCode: 'ABCDEF',
        }),
      ).resolves.toBeUndefined();
    });

    it('broadcasts STATE_UPDATED when a connected team disconnects', async () => {
      const playerA = await joinAsPlayer('socket-a');
      server.to.mockClear();
      server.emit.mockClear();

      gateway.handleDisconnect(asSocket(playerA));

      expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
      expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
      expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
      expect(server.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.STATE_UPDATED,
        expect.anything(),
      );
    });

    it('does not broadcast when a socket with no connected team disconnects', async () => {
      const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
      await gateway.handleConnection(asSocket(display));
      server.to.mockClear();
      server.emit.mockClear();

      gateway.handleDisconnect(asSocket(display));

      expect(server.emit).not.toHaveBeenCalled();
    });

    it('rejects KICK_TEAM from a non-admin client', async () => {
      const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
      await gateway.handleConnection(asSocket(player));

      expect(() =>
        gateway.handleKickTeam(asSocket(player), { teamId: 31 }),
      ).toThrow(WsException);
    });

    it('notifies and disconnects the connected socket when the admin kicks its team', async () => {
      const playerA = await joinAsPlayer('socket-a');
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      gateway.handleKickTeam(asSocket(admin), { teamId: 31 });

      expect(playerA.emit).toHaveBeenCalledWith(
        'exception',
        'You were removed from this team by the quiz master',
      );
      expect(playerA.disconnect).toHaveBeenCalledWith(true);
    });

    it('frees the connection slot so a new device can join after a kick', async () => {
      const playerA = await joinAsPlayer('socket-a');
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      gateway.handleKickTeam(asSocket(admin), { teamId: 31 });
      // A real disconnect() call fires the socket.io 'disconnect' event,
      // which our gateway hooks via handleDisconnect.
      gateway.handleDisconnect(asSocket(playerA));

      const playerB = await connectPlayer(gateway, server, 'socket-b');
      await expect(
        gateway.handleJoinPlayers(asSocket(playerB), {
          teamName: 'The Quizzards',
          joinCode: 'ABCDEF',
        }),
      ).resolves.toBeUndefined();
    });

    it('does nothing when kicking a team that has no connected socket', async () => {
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        password: ADMIN_PASSWORD,
      });
      await gateway.handleConnection(asSocket(admin));

      expect(() =>
        gateway.handleKickTeam(asSocket(admin), { teamId: 999 }),
      ).not.toThrow();
    });
  });
});
