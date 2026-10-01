import { WsException } from '@nestjs/websockets';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — grading gate before reveal', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let firstQuestionId: number;

  beforeEach(async () => {
    // One block spanning two rounds; both questions are human-graded, so a
    // submitted answer keeps the block from revealing until it is graded.
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          questions: [
            { type: 'audio', prompt: 'Name that tune', answer: 'Queen' },
          ],
        },
        {
          title: 'Round 2',
          breakAfter: true,
          questions: [
            { type: 'audio', prompt: 'Name that band', answer: 'Abba' },
          ],
        },
      ],
    });
    firstQuestionId = game.rounds[0].questionIds[0];
    for (const action of [
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> r1q1
    ] as const) {
      await game.act(action);
    }
  });

  async function submitAnswerToFirstQuestion(
    value = 'Banana',
  ): Promise<number> {
    const [{ socket, teamId }] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: firstQuestionId,
      teamId,
      value,
    });
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, firstQuestionId),
    );
    return answer.answerId;
  }

  async function advanceToBreakIntro() {
    await game.act('ADVANCE'); // -> round_intro(1)
    await game.act('ADVANCE'); // -> r2q1
    await game.act('ADVANCE'); // -> locking
    return game.act('ADVANCE'); // -> break_intro
  }

  it('rejects ADVANCE out of break_intro while a block question still has an ungraded answer', async () => {
    await submitAnswerToFirstQuestion();
    const breakIntro = await advanceToBreakIntro();
    expect(breakIntro.progress.status).toBe('break_intro');

    await expect(game.act('ADVANCE')).rejects.toThrow(WsException);

    // The rejected transition must not have been persisted.
    expect((await game.snapshot()).progress.status).toBe('break_intro');
  });

  it('lets ADVANCE out of break_intro when the only answer matches the key and was graded at submit', async () => {
    await submitAnswerToFirstQuestion(' queen ');
    const breakIntro = await advanceToBreakIntro();
    expect(breakIntro.ungradedQuestionIds).toEqual([]);

    const revealIntro = await game.act('ADVANCE');

    expect(revealIntro.progress.status).toBe('reveal_intro');
  });

  it('reports the ungraded question ids on the snapshot while reviewing the break screen', async () => {
    await submitAnswerToFirstQuestion();

    const breakIntro = await advanceToBreakIntro();

    expect(breakIntro.ungradedQuestionIds).toEqual([firstQuestionId]);
  });

  it('allows ADVANCE into reveal once the ungraded answer has been graded', async () => {
    const answerId = await submitAnswerToFirstQuestion();
    await advanceToBreakIntro();
    const admin = await game.connectAdmin();
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 1,
    });

    const revealIntro = await game.act('ADVANCE');

    expect(revealIntro.progress.status).toBe('reveal_intro');
  });

  it('allows ADVANCE into reveal once nothing is left ungraded', async () => {
    const breakIntro = await advanceToBreakIntro(); // nobody answered
    expect(breakIntro.progress.status).toBe('break_intro');
    expect(breakIntro.ungradedQuestionIds).toEqual([]);

    const revealIntro = await game.act('ADVANCE');

    expect(revealIntro.progress.status).toBe('reveal_intro');
  });
});

describe('GameGateway — grading gate for a wrong free_text answer', () => {
  const harness = setupRealStoreGatewayTest();

  it('refuses ADVANCE out of the break until the moderator grades the answer', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
          ],
        },
      ],
    });
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
    const [{ socket, teamId }] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value: 'Jupitor',
    });
    await game.act('ADVANCE'); // -> locking
    const breakIntro = await game.act('ADVANCE'); // -> break_intro
    expect(breakIntro.ungradedQuestionIds).toEqual([questionId]);

    await expect(game.act('ADVANCE')).rejects.toThrow(WsException);

    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    const admin = await game.connectAdmin();
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });
    const revealIntro = await game.act('ADVANCE');
    expect(revealIntro.progress.status).toBe('reveal_intro');
  });
});
