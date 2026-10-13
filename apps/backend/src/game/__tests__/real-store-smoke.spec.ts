import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

interface AnswersUpdated {
  questionId: number;
  answers: { answerId: number; teamId: number; pointsAwarded: number }[];
}

describe('GameGateway — real-store harness smoke', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
  });

  it('hands out the instances the module built, wired to each other', () => {
    const privates = (target: object) =>
      target as unknown as Record<string, unknown>;

    expect(privates(game.gateway).gameState).toBe(game.gameState);
    expect(privates(game.liveEdit).sessionWrite).toBe(
      privates(game.gameState).sessionWrite,
    );
    expect(privates(game.gameState).progressRepository).toBe(
      game.progressRepository,
    );
  });

  it('builds a fresh module over the same database on restart, leaving the earlier handle usable', async () => {
    const restarted = await game.restart();

    expect(restarted.gateway).not.toBe(game.gateway);
    expect(restarted.gameState).not.toBe(game.gameState);
    // Sockets and connected teams do not survive a restart; the earlier handle still answers.
    expect((await restarted.snapshot()).teams).toEqual([]);
    expect((await game.snapshot()).teams).toHaveLength(1);
  });

  it('plays a real submit and grade through the gateway and shows the results to each room', async () => {
    const admin = await game.connectAdmin();
    const [{ socket: team, teamId }] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();

    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });

    const [submitted] = game.payloadsTo<AnswersUpdated>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    expect(submitted.questionId).toBe(game.questionIds.multipleChoice);
    // multiple_choice is auto-graded at submit time: Paris is worth 2 points.
    expect(submitted.answers).toEqual([
      expect.objectContaining({ teamId, pointsAwarded: 2 }),
    ]);
    expect(team.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      expect.objectContaining({ value: 'Paris', pointsAwarded: 2 }),
    );

    game.clearEmits();
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: submitted.answers[0].answerId,
      pointsAwarded: 1,
    });

    const [regraded] = game.payloadsTo<AnswersUpdated>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    expect(regraded.answers).toEqual([
      expect.objectContaining({ teamId, pointsAwarded: 1 }),
    ]);
    for (const room of [
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        game.payloadsTo(room, SOCKET_EVENTS.STATE_UPDATED).length,
      ).toBeGreaterThan(0);
    }
  });
});
