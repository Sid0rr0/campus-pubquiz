import type { GameAction, StateSnapshotPayload } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const CLOSEST_GUESS_ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Round 1',
    breakAfter: true,
    questions: [
      {
        type: 'closest_guess',
        prompt: 'How many students attend this university?',
        points: 5,
        answer: '1000',
      },
      {
        type: 'free_text',
        prompt: 'Name a fruit',
        points: 1,
        answer: 'Apple',
      },
    ],
  },
];

const GUESSES = [
  { teamName: 'Team A', value: '900' },
  { teamName: 'Team B', value: '950' },
  { teamName: 'Team C', value: '2000' },
];

// Every test opens q1 (closest_guess) first and submits its guesses, so the
// action lists below start from there.
const TO_BREAK_INTRO: GameAction[] = [
  'ADVANCE', // -> q2 (free_text)
  'ADVANCE', // -> locking
  'ADVANCE', // -> break_intro (grading runs here)
];
const TO_REVEAL: GameAction[] = [
  ...TO_BREAK_INTRO,
  'ADVANCE', // -> reveal_intro(revealIndex 0)
  'ADVANCE', // -> reveal(revealIndex 0)
];

function pointsByTeam(snapshot: StateSnapshotPayload): Record<string, number> {
  return Object.fromEntries(
    snapshot.leaderboard.map((entry) => [entry.teamName, entry.totalPoints]),
  );
}

describe('GameGateway — closest_guess reveal-step gating', () => {
  const harness = setupRealStoreGatewayTest();

  /** Seeds the quiz, opens q1 and has each given team submit its guess for it. */
  async function startWithGuesses(
    guesses: { teamName: string; value: string }[],
  ): Promise<RealStoreGateway> {
    const game = await harness.createGateway({
      rounds: CLOSEST_GUESS_ROUNDS,
      teamNames: guesses.map(({ teamName }) => teamName),
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    await game.act('ADVANCE'); // -> q1 (closest_guess)
    for (const [index, { value }] of guesses.entries()) {
      const { socket, teamId } = game.teams[index];
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: game.rounds[0].questionIds[0],
        teamId,
        value,
      });
    }
    return game;
  }

  async function actAll(game: RealStoreGateway, actions: GameAction[]) {
    let snapshot = await game.snapshot();
    for (const action of actions) {
      snapshot = await game.act(action);
    }
    return snapshot;
  }

  it('grades the closest_guess question once the block locks, before reveal starts', async () => {
    const game = await startWithGuesses(GUESSES);

    // Guesses can only be compared once every team is done, so nothing is
    // scored while the block is still open or locking.
    const ungraded = { 'Team A': 0, 'Team B': 0, 'Team C': 0 };
    expect(pointsByTeam(await actAll(game, ['ADVANCE']))).toEqual(ungraded); // q2
    expect(pointsByTeam(await game.act('ADVANCE'))).toEqual(ungraded); // locking

    const graded = await game.act('ADVANCE'); // -> break_intro, grading runs
    // Team B's 950 is closest to 1000: full points, everyone else zero.
    expect(pointsByTeam(graded)).toEqual({
      'Team A': 0,
      'Team B': 5,
      'Team C': 0,
    });
  });

  it('refreshes the leaderboard as soon as the closest_guess question is auto-graded', async () => {
    const game = await startWithGuesses(GUESSES);

    // break_intro is where the batch grading runs — the leaderboard must
    // already reflect the new points on this very snapshot, not just after a
    // later GRADE_ANSWER/TOGGLE_LEADERBOARD action.
    const graded = await actAll(game, TO_BREAK_INTRO);

    expect(graded.progress.status).toBe('break_intro');
    expect(pointsByTeam(graded)).toEqual({
      'Team A': 0,
      'Team B': 5,
      'Team C': 0,
    });
  });

  it('keeps the same points when the quiz steps on from break into reveal', async () => {
    const game = await startWithGuesses(GUESSES);
    const atBreak = await actAll(game, TO_BREAK_INTRO);

    const atReveal = await actAll(game, ['ADVANCE', 'ADVANCE']);

    expect(pointsByTeam(atReveal)).toEqual(pointsByTeam(atBreak));
  });

  it('walks ADVANCE through all 5 cumulative reveal steps before moving to the next question', async () => {
    const game = await startWithGuesses(GUESSES);
    const step0 = await actAll(game, TO_REVEAL);

    // Step 0: just the question, nothing revealed yet.
    expect(step0.progress.revealIndex).toBe(0);
    expect(step0.closestGuessRevealStep).toBe(0);
    expect(step0.revealQuestions[0].closestGuess).toEqual({
      hasSubmissions: true,
      minGuess: '900',
      maxGuess: '2000',
      closestGuesses: [{ teamName: 'Team B', value: '950' }],
    });

    const step1 = await game.act('ADVANCE');
    expect(step1.progress.status).toBe('reveal');
    expect(step1.progress.revealIndex).toBe(0);
    expect(step1.closestGuessRevealStep).toBe(1);

    const step2 = await game.act('ADVANCE');
    expect(step2.closestGuessRevealStep).toBe(2);
    expect(step2.progress.revealIndex).toBe(0);

    const step3 = await game.act('ADVANCE');
    expect(step3.closestGuessRevealStep).toBe(3);
    expect(step3.progress.revealIndex).toBe(0);

    const step4 = await game.act('ADVANCE');
    expect(step4.closestGuessRevealStep).toBe(4);
    expect(step4.progress.revealIndex).toBe(0);

    // A 6th ADVANCE finally moves on to the block's next question.
    const nextQuestion = await game.act('ADVANCE');
    expect(nextQuestion.progress.revealIndex).toBe(1);
    expect(nextQuestion.closestGuessRevealStep).toBe(0);
  });

  it("walks PREVIOUS backward symmetrically, landing on the previous question's last step", async () => {
    const game = await startWithGuesses(GUESSES);
    await actAll(game, [
      ...TO_REVEAL,
      'ADVANCE', // step 1
      'ADVANCE', // step 2
      'ADVANCE', // step 3
      'ADVANCE', // step 4
      'ADVANCE', // -> revealIndex 1 (q2)
    ]);

    const backToQ1 = await game.act('PREVIOUS');
    expect(backToQ1.progress.revealIndex).toBe(0);
    expect(backToQ1.closestGuessRevealStep).toBe(4);

    const backToStep3 = await game.act('PREVIOUS');
    expect(backToStep3.progress.revealIndex).toBe(0);
    expect(backToStep3.closestGuessRevealStep).toBe(3);

    await game.act('PREVIOUS'); // step 2
    await game.act('PREVIOUS'); // step 1
    await game.act('PREVIOUS'); // step 0

    const backToIntro = await game.act('PREVIOUS');
    expect(backToIntro.progress.status).toBe('reveal_intro');
  });

  it('collapses to a single reveal step when nobody submitted a guess', async () => {
    const game = await startWithGuesses([]);

    const step0 = await actAll(game, TO_REVEAL);

    expect(step0.closestGuessRevealStep).toBe(0);
    expect(step0.revealQuestions[0].closestGuess).toEqual({
      hasSubmissions: false,
      closestGuesses: [],
    });

    // A single ADVANCE moves straight to the next question — no gated steps.
    const nextQuestion = await game.act('ADVANCE');
    expect(nextQuestion.progress.revealIndex).toBe(1);
  });
});
