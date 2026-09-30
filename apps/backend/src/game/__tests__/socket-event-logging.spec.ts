import { Logger } from '@nestjs/common';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import {
  TEST_SESSION_TOKEN,
  asSocket,
  createMockSocket,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — socket event logging', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    game = await harness.createGateway();
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
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'display-7',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('display-7'));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_ROOMS.DISPLAY),
    );
  });

  it('warns when a connection is rejected for an unrecognized role', async () => {
    const client = createMockSocket(
      'not-a-real-room',
      {},
      'stranger',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(client));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not-a-real-room'),
    );
  });

  it('warns when an admin connection is rejected for an invalid session token', async () => {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: 'wrong-token' },
      'bad-admin',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(admin));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('session'));
  });

  it('logs an ADMIN_ACTION event with the action name', async () => {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'good-admin',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(admin));

    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_EVENTS.ADMIN_ACTION),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('START_QUIZ'));
  });

  it('logs a JOIN_PLAYERS event with the team name', async () => {
    await game.joinTeam('The Quizzards');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_EVENTS.JOIN_PLAYERS),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('The Quizzards'),
    );
  });

  it('logs a SUBMIT_ANSWER event with the question and team ids', async () => {
    const admin = await game.connectAdmin();
    const { socket: team, teamId } = await game.joinTeam('The Quizzards');
    await game.openFirstQuestion(admin);
    const questionId = game.questionIds.multipleChoice;

    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId,
      teamId,
      value: 'Banana',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_EVENTS.SUBMIT_ANSWER),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`questionId=${questionId}`),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`teamId=${teamId}`),
    );
  });

  it('logs a GRADE_ANSWER event with the answer id and points', async () => {
    const admin = await game.connectAdmin();
    const { socket: team, teamId } = await game.joinTeam('The Quizzards');
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });
    const [{ answers }] = game.payloadsTo<{ answers: { answerId: number }[] }>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    const { answerId } = answers[0];

    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 1,
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOCKET_EVENTS.GRADE_ANSWER),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`answerId=${answerId}`),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('pointsAwarded=1'),
    );
  });
});
