import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const freeText = (prompt: string) => ({
  type: 'free_text' as const,
  prompt,
  answer: `Answer to ${prompt}`,
});

describe('GameGateway — editing the unopened questions of the current round', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [freeText('Q1'), freeText('Q2'), freeText('Q3')],
        },
        { title: 'Round B', breakAfter: true, questions: [freeText('Q4')] },
      ],
    });
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action); // -> rules -> round_intro(A) -> Q1 open
    }
  });

  /** Q2 moves to the end and a new question follows it, so Q1 stays first. */
  async function moveQ2ToTheEndAndAppendNewQuestion(): Promise<void> {
    await game.saveQuizEdit((rounds) =>
      rounds.map((round, index) => {
        if (index !== 0) return round;
        const [q1, q2, q3] = round.questions;
        return {
          ...round,
          questions: [
            q1,
            q3,
            q2,
            {
              type: 'free_text',
              prompt: 'Q-new',
              answer: 'Answer to Q-new',
              points: 1,
            },
          ],
        };
      }),
    );
  }

  const currentPrompt = async (): Promise<string | undefined> =>
    (await game.snapshot()).currentQuestion?.prompt;

  it('carries on from the same opened question after a save', async () => {
    await moveQ2ToTheEndAndAppendNewQuestion();

    const snapshot = await game.snapshot();

    expect(snapshot.progress).toMatchObject({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
    });
    expect(snapshot.currentQuestion).toMatchObject({ prompt: 'Q1' });
  });

  it('opens the question now placed after the opened one on the next press', async () => {
    await moveQ2ToTheEndAndAppendNewQuestion();

    const prompts: (string | undefined)[] = [];
    for (let press = 0; press < 3; press += 1) {
      await game.act('ADVANCE');
      prompts.push(await currentPrompt());
    }

    expect(prompts).toEqual(['Q3', 'Q2', 'Q-new']);
  });

  it('puts the locking countdown on the question now last in the round', async () => {
    await moveQ2ToTheEndAndAppendNewQuestion();
    for (let press = 0; press < 3; press += 1) await game.act('ADVANCE');

    const locking = await game.act('ADVANCE');

    expect(locking.progress).toMatchObject({
      status: 'locking',
      questionIndex: 3,
    });
  });

  it('keeps the opened question opened and reports an unlocked frontier', async () => {
    await moveQ2ToTheEndAndAppendNewQuestion();

    expect(game.liveEdit.getFrontier(game.quizId)).toMatchObject({
      openedQuestionIds: [game.rounds[0].questionIds[0]],
      currentRoundIndex: 0,
      hasCurrentBlockStartedLocking: false,
    });
  });
});

describe('GameGateway — editing the rounds after the current round', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        { title: 'Round A', breakAfter: false, questions: [freeText('Q1')] },
        { title: 'Round B', breakAfter: false, questions: [freeText('Q2')] },
        { title: 'Round C', breakAfter: true, questions: [freeText('Q3')] },
      ],
    });
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action); // -> rules -> round_intro(A) -> Q1 open
    }
  });

  async function turnOnBreakAfterRound(roundIndex: number): Promise<void> {
    await game.saveQuizEdit((rounds) =>
      rounds.map((round, index) =>
        index === roundIndex ? { ...round, breakAfter: true } : round,
      ),
    );
  }

  it("moves where the current block ends when a later round's break-after is turned on", async () => {
    await turnOnBreakAfterRound(1);

    let progress = (await game.snapshot()).progress;
    for (
      let press = 0;
      press < 10 && progress.status !== 'locking';
      press += 1
    ) {
      progress = (await game.act('ADVANCE')).progress;
    }

    expect(progress).toMatchObject({ status: 'locking', roundIndex: 1 });
  });
});
