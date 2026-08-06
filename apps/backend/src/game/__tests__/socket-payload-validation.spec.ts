import { WsException } from '@nestjs/websockets';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  openFirstQuestion,
  asSocket,
  type MockServer,
  type MockAnswerService,
  type MockBonusService,
  type MockTeamService,
} from './test-utils';

describe('GameGateway — socket payload validation', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let answerService: MockAnswerService;
  let bonusService: MockBonusService;
  let teamService: MockTeamService;

  beforeEach(async () => {
    ({ gateway, server, answerService, bonusService, teamService } =
      await createTestGateway());
  });

  it('rejects ADMIN_ACTION with an unrecognized action string', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));
    server.to.mockClear();
    server.emit.mockClear();

    await expect(
      gateway.handleAdminAction(asSocket(admin), {
        action: 'DELETE_EVERYTHING',
      }),
    ).rejects.toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('rejects JOIN_PLAYERS with a blank team name', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleJoinPlayers(asSocket(player), { teamName: '' }),
    ).rejects.toThrow(WsException);
    expect(teamService.join).not.toHaveBeenCalled();
  });

  it('rejects SUBMIT_ANSWER with a non-numeric teamId', async () => {
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSubmitAnswer(asSocket(player), {
        questionId: 21,
        teamId: 'not-a-number',
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });

  it('rejects SUBMIT_ANSWER whose value exceeds the max length', async () => {
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSubmitAnswer(asSocket(player), {
        questionId: 21,
        teamId: 31,
        value: 'x'.repeat(2001),
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });

  it('rejects GRADE_ANSWER with a non-finite pointsAwarded', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleGradeAnswer(asSocket(admin), {
        answerId: 41,
        pointsAwarded: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.grade).not.toHaveBeenCalled();
  });

  it('rejects AWARD_BONUS with an unrecognized category', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleAwardBonus(asSocket(admin), {
        teamId: 31,
        category: 'jackpot',
        points: 1,
      }),
    ).rejects.toThrow(WsException);
    expect(bonusService.award).not.toHaveBeenCalled();
  });

  it('rejects SELECT_QUIZ with a non-positive quizId', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleSelectQuiz(asSocket(admin), { quizId: -1 }),
    ).rejects.toThrow(WsException);
  });
});
