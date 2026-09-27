import { WsException } from '@nestjs/websockets';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createFakeKahootSeedService,
  createTestGateway,
  createMockSocket,
  asSocket,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — kahoot question hidden behind the leaderboard', () => {
  let gateway: GameGateway;
  let answerService: MockAnswerService;

  beforeEach(async () => {
    ({ gateway, answerService } = await createTestGateway(
      createFakeKahootSeedService(),
    ));
  });

  /** Drives q0 (id 31) through question_open -> locking -> reveal -> the
   * next question (id 32), which opens hidden behind the leaderboard (see
   * advanceFromReveal). */
  async function openSecondKahootQuestionBehindLeaderboard() {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-admin',
      'KAHOOT',
    );
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> round_intro
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> question_open q0 (id 31)
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> locking
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> reveal
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> question_open q1 (id 32), isLeaderboardVisible: true
    return admin;
  }

  it('rejects SUBMIT_ANSWER for a kahoot question still hidden behind the leaderboard', async () => {
    await openSecondKahootQuestionBehindLeaderboard();
    const player = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'socket-1',
      'KAHOOT',
    );
    await gateway.handleConnection(asSocket(player));
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });

    await expect(
      gateway.handleSubmitAnswer(asSocket(player), {
        questionId: 32,
        teamId: 31,
        value: 'Rome',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });

  it('accepts SUBMIT_ANSWER for that question once TOGGLE_LEADERBOARD reveals it', async () => {
    const admin = await openSecondKahootQuestionBehindLeaderboard();
    await gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    });
    const player = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'socket-1',
      'KAHOOT',
    );
    await gateway.handleConnection(asSocket(player));
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 32,
      teamId: 31,
      value: 'Rome',
    });

    expect(answerService.submit).toHaveBeenCalledWith(
      103,
      32,
      31,
      'Rome',
      expect.any(Number),
    );
  });
});
