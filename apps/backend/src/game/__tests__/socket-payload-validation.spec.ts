import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import {
  asSocket,
  createMockSocket,
  type MockSocket,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const OVER_MAX_ANSWER_LENGTH = 'x'.repeat(2001);

describe('GameGateway — socket payload validation', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: MockSocket;
  let teamId: number;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    ({ socket: team, teamId } = game.teams[0]);
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  /** A rejected payload must leave no trace: nothing broadcast, nothing told to the sender. */
  function expectNothingDelivered(sender: MockSocket): void {
    expect(game.roomEmits()).toEqual([]);
    expect(sender.emit).not.toHaveBeenCalled();
  }

  it('rejects ADMIN_ACTION with an unrecognized action string', async () => {
    await expect(
      game.gateway.handleAdminAction(asSocket(admin), {
        action: 'DELETE_EVERYTHING',
      }),
    ).rejects.toThrow(WsException);
    expectNothingDelivered(admin);
  });

  it('rejects JOIN_PLAYERS with a blank team name', async () => {
    const player = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'blank-name',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(player));
    game.clearEmits();
    player.emit.mockClear(); // the state sync every connection gets

    await expect(
      game.gateway.handleJoinPlayers(asSocket(player), { teamName: '' }),
    ).rejects.toThrow(WsException);

    expectNothingDelivered(player);
    const { teams } = await game.snapshot();
    expect(teams.map((entry) => entry.teamName)).toEqual(['The Quizzards']);
  });

  it('rejects SUBMIT_ANSWER with a non-numeric teamId', async () => {
    await expect(
      game.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: game.questionIds.multipleChoice,
        teamId: 'not-a-number',
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expectNothingDelivered(team);
  });

  it('rejects SUBMIT_ANSWER whose value exceeds the max length', async () => {
    await expect(
      game.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: game.questionIds.multipleChoice,
        teamId,
        value: OVER_MAX_ANSWER_LENGTH,
      }),
    ).rejects.toThrow(WsException);
    expectNothingDelivered(team);
  });

  it('rejects GRADE_ANSWER with a non-finite pointsAwarded', async () => {
    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });
    const [{ answers }] = game.payloadsTo<{
      answers: { answerId: number }[];
    }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED);
    game.clearEmits();
    team.emit.mockClear();

    await expect(
      game.gateway.handleGradeAnswer(asSocket(admin), {
        answerId: answers[0].answerId,
        pointsAwarded: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow(WsException);
    expectNothingDelivered(admin);
    expect(team.emit).not.toHaveBeenCalled();
  });

  it('rejects AWARD_BONUS with an unrecognized category', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId,
        category: 'jackpot',
        points: 1,
      }),
    ).rejects.toThrow(WsException);
    expectNothingDelivered(admin);
    const { leaderboard } = await game.snapshot();
    expect(leaderboard.filter((entry) => entry.bonusPoints !== 0)).toEqual([]);
  });
});
