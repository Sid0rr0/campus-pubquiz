import type { DisplayStatePayload } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const TWO_BLOCKS: QuizRoundSpec[] = [1, 2].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: `Question of round ${number}?`,
      answer: 'right',
      points: 1000,
      payload: { options: ['right', 'wrong'] },
    },
  ],
}));

const MAX_ADVANCES = 12;

describe('Display view — fun facts on the break screen', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function displayView(): Promise<DisplayStatePayload> {
    return game.resync('display');
  }

  async function answer(roundIndex: number, values: string[]) {
    for (const [index, value] of values.entries()) {
      const { socket, teamId } = game.teams[index];
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: game.rounds[roundIndex].questionIds[0],
        teamId,
        value,
      });
    }
  }

  async function advanceUntil(
    isReached: (view: DisplayStatePayload) => boolean,
  ) {
    for (let step = 0; step < MAX_ADVANCES; step += 1) {
      await game.act('ADVANCE');
      if (isReached(await displayView())) return;
    }
    throw new Error('The screen was never reached');
  }

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: TWO_BLOCKS,
      teamNames: ['Team 1', 'Team 2'],
    });
    await game.act('START_QUIZ');
    await advanceUntil((view) => view.progress.status === 'question_open');
  });

  it('is empty while a question is on air', async () => {
    await answer(0, ['right', 'wrong']);

    expect((await displayView()).funFacts).toEqual([]);
  });

  it('carries no fun facts on the first break when no bonus was awarded', async () => {
    await answer(0, ['right', 'wrong']);
    await advanceUntil((view) => view.onAirScreen.kind === 'break_intro');

    const view = await displayView();

    expect(view.funFacts).toEqual([]);
  });

  it('reads revealed blocks on the next break but never the block in play', async () => {
    await answer(0, ['wrong', 'wrong']);
    await advanceUntil(
      (view) =>
        view.progress.status === 'question_open' &&
        view.progress.roundIndex === 1,
    );
    await answer(1, ['wrong', 'wrong']);
    await advanceUntil((view) => view.onAirScreen.kind === 'break_intro');

    const { funFacts } = await displayView();

    const firstQuestionId = game.rounds[0].questionIds[0];
    const secondQuestionId = game.rounds[1].questionIds[0];
    const nobodyGotIt = funFacts.find((fact) => fact.kind === 'nobody_got_it');
    expect(nobodyGotIt).toMatchObject({
      question: { questionId: firstQuestionId },
    });
    const mentionedIds = funFacts.flatMap((fact) =>
      'question' in fact ? [fact.question.questionId] : [],
    );
    expect(mentionedIds).not.toContain(secondQuestionId);
  });
});
