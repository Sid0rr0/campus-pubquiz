import { asSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — grades and bonus awards wait their turn in the session write', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let questionId: number;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'audio', prompt: 'Name that tune', answer: 'Queen' },
          ],
        },
      ],
    });
    questionId = game.rounds[0].questionIds[0];
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function submitAnswer(): Promise<number> {
    const [{ socket, teamId }] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value: 'Banana',
    });
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    return answer.answerId;
  }

  it('stores a grade only after the press ahead of it has finished, and leaves nothing ungraded', async () => {
    const answerId = await submitAnswer();
    await game.act('ADVANCE'); // -> break_intro
    const admin = await game.connectAdmin();
    const gradeSpy = jest.spyOn(game.answerService, 'grade');

    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await held.started;
    const waiting = game.nextWriteWaiting();
    const grading = game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 1,
    });
    await waiting;

    expect(gradeSpy).not.toHaveBeenCalled();
    held.release();
    await Promise.all([pressing, grading]);

    expect(gradeSpy).toHaveBeenCalledTimes(1);
    expect((await game.snapshot()).ungradedQuestionIds).toEqual([]);
  });

  it('stores nothing and reports the message when the answer module refuses the grade', async () => {
    const admin = await game.connectAdmin();

    const result = await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: 999999,
      pointsAwarded: 1,
    });

    expect(result).toMatchObject({ success: false });
    expect((await game.snapshot()).ungradedQuestionIds).toEqual([]);
  });

  it('reads the bonus limits and stores an award only after the write ahead of it has finished', async () => {
    const admin = await game.connectAdmin();
    const [{ teamId }] = game.teams;
    const awardSpy = jest.spyOn(game.bonusService, 'award');

    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await held.started;
    const waiting = game.nextWriteWaiting();
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId,
      category: 'shot',
      points: 1,
    });
    await waiting;

    expect(awardSpy).not.toHaveBeenCalled();
    held.release();
    await Promise.all([pressing, awarding]);

    expect(awardSpy).toHaveBeenCalledTimes(1);
  });
});
