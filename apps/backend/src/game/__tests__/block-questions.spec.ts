import type { GameAction } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const START_TO_R1Q1: GameAction[] = [
  'START_QUIZ',
  'ADVANCE', // -> round_intro(0)
  'ADVANCE', // -> r1q1
];
const R1Q1_TO_R2Q1: GameAction[] = [
  'ADVANCE', // -> r1q2
  'ADVANCE', // -> round_intro(1)
  'ADVANCE', // -> r2q1 (same block)
];
const TO_R2Q1: GameAction[] = [...START_TO_R1Q1, ...R1Q1_TO_R2Q1];
const TO_BREAK_INTRO: GameAction[] = [
  ...TO_R2Q1,
  'ADVANCE', // -> r2q2
  'ADVANCE', // -> locking
  'ADVANCE', // -> break_intro
];

describe('GameGateway — block questions and upcoming questions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function actAll(actions: GameAction[], from = game) {
    let snapshot = await from.snapshot();
    for (const action of actions) {
      snapshot = await from.act(action);
    }
    return snapshot;
  }

  /** Question ids by [roundIndex, questionIndex]. */
  function ids(...positions: [number, number][]): number[] {
    return positions.map(
      ([round, question]) => game.rounds[round].questionIds[question],
    );
  }

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
  });

  it('exposes no block questions in the lobby', async () => {
    expect((await game.snapshot()).blockQuestions).toEqual([]);
  });

  it('reveals block questions cumulatively as the admin advances', async () => {
    const r1q1 = await actAll(START_TO_R1Q1);
    expect(r1q1.blockQuestions.map((q) => q.id)).toEqual(ids([0, 0]));

    const r2q1 = await actAll(R1Q1_TO_R2Q1);
    expect(r2q1.blockQuestions.map((q) => q.id)).toEqual(
      ids([0, 0], [0, 1], [1, 0]),
    );
  });

  it('keeps an already-opened question answerable after the admin steps the display back with PREVIOUS', async () => {
    const { socket: team, teamId } = await game.joinTeam('The Quizzards');
    const opened = await actAll(TO_R2Q1); // furthest reached: r1q1, r1q2, r2q1
    expect(opened.blockQuestions.map((q) => q.id)).toEqual(
      ids([0, 0], [0, 1], [1, 0]),
    );

    await game.act('PREVIOUS'); // -> round_intro(1)
    const back = await game.act('PREVIOUS'); // -> r1q2 again, display steps backward

    expect(back.progress.status).toBe('question_open');
    expect(back.currentQuestion?.id).toBe(ids([0, 1])[0]);
    // r2q1 was already shown on display before stepping back — it must stay
    // revealed/answerable for players even though it's no longer on screen.
    expect(back.blockQuestions.map((q) => q.id)).toEqual(
      ids([0, 0], [0, 1], [1, 0]),
    );
    await expect(
      game.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: ids([1, 0])[0],
        teamId,
        value: 'Eiffel Tower',
      }),
    ).resolves.toBeUndefined();
    // Only r2q2 has genuinely never been shown yet.
    expect(back.upcomingQuestions).toEqual([
      {
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Landmarks & Flags',
      },
    ]);
  });

  it("shows no block questions yet on a fresh round's intro card, with the whole round upcoming", async () => {
    const freshIntro = await actAll([
      ...START_TO_R1Q1,
      'ADVANCE', // -> r1q2
      'ADVANCE', // -> round_intro(1), nothing opened in round 2 yet
    ]);

    expect(freshIntro.progress.status).toBe('round_intro');
    expect(freshIntro.blockQuestions.map((q) => q.id)).toEqual(
      ids([0, 0], [0, 1]),
    );
    expect(freshIntro.upcomingQuestions).toEqual([
      {
        roundNumber: 2,
        questionNumberInRound: 1,
        roundTitle: 'Landmarks & Flags',
      },
      {
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Landmarks & Flags',
      },
    ]);
  });

  it("keeps a round's questions answerable directly on its intro card when Previous steps back into it", async () => {
    const { socket: team, teamId } = await game.joinTeam('The Quizzards');
    await actAll(TO_R2Q1); // furthest reached: r1q1, r1q2, r2q1

    const backOnIntroCard = await game.act('PREVIOUS'); // -> round_intro(1), r2q1 already open

    expect(backOnIntroCard.progress.status).toBe('round_intro');
    expect(backOnIntroCard.currentQuestion).toBeNull();
    // r2q1 stays revealed/answerable underneath the intro card, same as
    // Previous stepping back onto an already-open question directly.
    expect(backOnIntroCard.blockQuestions.map((q) => q.id)).toEqual(
      ids([0, 0], [0, 1], [1, 0]),
    );
    await expect(
      game.gateway.handleSubmitAnswer(asSocket(team), {
        questionId: ids([1, 0])[0],
        teamId,
        value: 'Eiffel Tower',
      }),
    ).resolves.toBeUndefined();
    expect(backOnIntroCard.upcomingQuestions).toEqual([
      {
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Landmarks & Flags',
      },
    ]);
  });

  it('keeps the whole locked block browsable during the grading break', async () => {
    const snapshot = await actAll(TO_BREAK_INTRO);

    expect(snapshot.progress.status).toBe('break_intro');
    expect(snapshot.blockQuestions.map((q) => q.id)).toEqual(
      ids([0, 0], [0, 1], [1, 0], [1, 1]),
    );
  });

  it('never leaks the correct answer through blockQuestions, even during break', async () => {
    const snapshot = await actAll(TO_BREAK_INTRO);

    snapshot.blockQuestions.forEach((question) => {
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('answerMediaUrl');
    });
  });

  it('never leaks the correct answer through currentQuestion while a question is open', async () => {
    const snapshot = await actAll(START_TO_R1Q1);

    expect(snapshot.currentQuestion).not.toHaveProperty('answer');
    expect(snapshot.currentQuestion).not.toHaveProperty('answerMediaUrl');
  });

  it('labels block questions with their round and in-round position', async () => {
    const snapshot = await actAll([
      ...TO_R2Q1,
      'ADVANCE', // -> r2q2
    ]);

    expect(
      snapshot.blockQuestions.map((q) => [
        q.id,
        q.roundNumber,
        q.questionNumberInRound,
      ]),
    ).toEqual([
      [ids([0, 0])[0], 1, 1],
      [ids([0, 1])[0], 1, 2],
      [ids([1, 0])[0], 2, 1],
      [ids([1, 1])[0], 2, 2],
    ]);
  });

  it('exposes the rest of the block — spanning every remaining round up to the break — as upcoming while a question is open', async () => {
    const r1q1 = await actAll(START_TO_R1Q1);
    // Round 1 has no break, so round 2 (which does) is still part of the
    // same block — its whole shape is upcoming too, not just round 1's.
    expect(r1q1.upcomingQuestions).toEqual([
      {
        roundNumber: 1,
        questionNumberInRound: 2,
        roundTitle: 'General Knowledge',
      },
      {
        roundNumber: 2,
        questionNumberInRound: 1,
        roundTitle: 'Landmarks & Flags',
      },
      {
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Landmarks & Flags',
      },
    ]);

    const r1q2 = await game.act('ADVANCE'); // -> r1q2
    expect(r1q2.upcomingQuestions).toEqual([
      {
        roundNumber: 2,
        questionNumberInRound: 1,
        roundTitle: 'Landmarks & Flags',
      },
      {
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Landmarks & Flags',
      },
    ]);

    await game.act('ADVANCE'); // -> round_intro(1)
    const r2q1 = await game.act('ADVANCE'); // -> r2q1
    // Round 2 has a break, so the block ends here — nothing beyond it.
    expect(r2q1.upcomingQuestions).toEqual([
      {
        roundNumber: 2,
        questionNumberInRound: 2,
        roundTitle: 'Landmarks & Flags',
      },
    ]);

    const r2q2 = await game.act('ADVANCE'); // -> r2q2
    expect(r2q2.upcomingQuestions).toEqual([]);
  });

  it('exposes every remaining question in the round as upcoming, not just the next one', async () => {
    const triple = await harness.createGateway({
      joinCode: 'TRIPLE',
      rounds: [
        {
          title: 'Triple Round',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Q1', answer: 'A1' },
            { type: 'free_text', prompt: 'Q2', answer: 'A2' },
            { type: 'free_text', prompt: 'Q3', answer: 'A3' },
          ],
        },
      ],
    });

    const q1 = await actAll(START_TO_R1Q1, triple);
    expect(q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2, roundTitle: 'Triple Round' },
      { roundNumber: 1, questionNumberInRound: 3, roundTitle: 'Triple Round' },
    ]);

    const q2 = await triple.act('ADVANCE'); // -> q2
    expect(q2.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 3, roundTitle: 'Triple Round' },
    ]);

    const q3 = await triple.act('ADVANCE'); // -> q3
    expect(q3.upcomingQuestions).toEqual([]);
  });

  it('exposes no upcoming questions outside question_open/locking', async () => {
    expect((await game.snapshot()).upcomingQuestions).toEqual([]);

    const locking = await actAll([
      ...TO_R2Q1,
      'ADVANCE', // -> r2q2
      'ADVANCE', // -> locking
    ]);
    expect(locking.upcomingQuestions).toEqual([]);

    const brk = await game.act('ADVANCE'); // -> break
    expect(brk.upcomingQuestions).toEqual([]);

    await game.act('ADVANCE'); // -> reveal_intro
    const revealed = await game.act('ADVANCE'); // -> reveal
    expect(revealed.upcomingQuestions).toEqual([]);
  });
});
