import { Logger } from '@nestjs/common';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  openFirstQuestion,
  asSocket,
  type MockServer,
} from './test-utils';

describe('GameGateway — socket event logging', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    ({ gateway, server } = await createTestGateway());
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

  it('warns when an admin connection is rejected for an invalid session token', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: 'wrong-token',
    });
    await gateway.handleConnection(asSocket(admin));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('session'));
  });

  it('logs an ADMIN_ACTION event with the action name', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_EVENTS.ADMIN_ACTION),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('START_QUIZ'));
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
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });

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
      token: TEST_SESSION_TOKEN,
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

  it('logs a SELECT_QUIZ event with the quiz id', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleSelectQuiz(asSocket(admin), { quizId: 2 });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_EVENTS.SELECT_QUIZ),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
  });
});
