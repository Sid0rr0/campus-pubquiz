import { describe, expect, it } from 'vitest';
import type { AnswerView } from '../answers';
import {
  closestGuessRevealDescriptor,
  FULLY_REVEALED_STEP,
  shownAtStep,
  summarizeClosestGuess,
} from '../closest-guess-reveal';
import type { BlockRevealQuestionView } from '../question-views';
import {
  closestGuessQuestion,
  freeTextQuestion,
  round,
  sessionWith,
} from './session-fixtures';

function answer(teamName: string, value: string): AnswerView {
  return {
    answerId: 1,
    teamId: 1,
    teamName,
    value,
    pointsAwarded: 0,
    gradingState: 'ungraded',
    gradedAt: null,
    verdict: null,
  };
}

describe('summarizeClosestGuess', () => {
  it('reports no submissions when there are no answers', () => {
    expect(summarizeClosestGuess('55', [])).toStrictEqual({
      hasSubmissions: false,
      closestGuesses: [],
    });
  });

  it('reports no submissions when no answer is a number', () => {
    expect(
      summarizeClosestGuess('55', [
        answer('A', 'many'),
        answer('B', 'Infinity'),
      ]),
    ).toStrictEqual({ hasSubmissions: false, closestGuesses: [] });
  });

  it('finds the smallest and largest guess whatever the order, and who is closest', () => {
    expect(
      summarizeClosestGuess('55', [
        answer('Mid', '50'),
        answer('Low', '10'),
        answer('High', '200'),
        answer('Near', '54'),
      ]),
    ).toStrictEqual({
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '200',
      closestGuesses: [{ teamName: 'Near', value: '54' }],
    });
  });

  it('finds the extremes when the first answer is the largest', () => {
    const summary = summarizeClosestGuess('55', [
      answer('High', '90'),
      answer('Mid', '60'),
      answer('Low', '20'),
    ]);
    expect(summary.minGuess).toBe('20');
    expect(summary.maxGuess).toBe('90');
  });

  it('keeps the first of equal guesses as the extreme', () => {
    const summary = summarizeClosestGuess('55', [
      answer('A', '5'),
      answer('B', '5.0'),
      answer('C', '9'),
      answer('D', '9.0'),
    ]);
    expect(summary.minGuess).toBe('5');
    expect(summary.maxGuess).toBe('9');
  });

  it('ignores non-numeric answers for the extremes and never calls them closest', () => {
    expect(
      summarizeClosestGuess('55', [
        answer('Words', 'lots'),
        answer('Only', '30'),
      ]),
    ).toStrictEqual({
      hasSubmissions: true,
      minGuess: '30',
      maxGuess: '30',
      closestGuesses: [{ teamName: 'Only', value: '30' }],
    });
  });

  it('lists every team tied for closest with its own value', () => {
    expect(
      summarizeClosestGuess('100', [
        answer('Under', '90'),
        answer('Over', '110'),
        answer('Far', '10'),
      ]).closestGuesses,
    ).toStrictEqual([
      { teamName: 'Under', value: '90' },
      { teamName: 'Over', value: '110' },
    ]);
  });
});

describe('shownAtStep', () => {
  const full: BlockRevealQuestionView = {
    ...closestGuessQuestion(7),
    revealKind: 'closest_guess',
    roundNumber: 1,
    questionNumberInRound: 2,
    roundTitle: 'Round 1',
    closestGuess: {
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '200',
      closestGuesses: [{ teamName: 'Near', value: '54' }],
    },
  } as unknown as BlockRevealQuestionView;

  it('is the question-only step before any line: pending, no answer, no stats', () => {
    const shown = shownAtStep(full, 0);
    expect(shown.revealKind).toBe('closest_guess_pending');
    expect(shown).not.toHaveProperty('answer');
    expect(shown).toMatchObject({
      id: 7,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
    });
    expect(shown).toHaveProperty('closestGuess', { hasSubmissions: true });
  });

  it('adds one line per step, keeping the earlier ones', () => {
    const closestAt = (step: number) =>
      (shownAtStep(full, step) as { closestGuess: unknown }).closestGuess;
    expect(closestAt(1)).toStrictEqual({
      hasSubmissions: true,
      minGuess: '10',
    });
    expect(closestAt(2)).toStrictEqual({
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '200',
    });
    expect(closestAt(3)).toStrictEqual({
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '200',
    });
    expect(closestAt(4)).toStrictEqual({
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '200',
      closestGuesses: [{ teamName: 'Near', value: '54' }],
    });
  });

  it('stays pending through the second line and shows the answer from the third', () => {
    expect(shownAtStep(full, 2).revealKind).toBe('closest_guess_pending');
    expect(shownAtStep(full, 2)).not.toHaveProperty('answer');
    const answered = shownAtStep(full, 3);
    expect(answered.revealKind).toBe('closest_guess');
    expect(answered).toHaveProperty('answer', '55');
    expect(shownAtStep(full, FULLY_REVEALED_STEP).revealKind).toBe(
      'closest_guess',
    );
  });

  it('leaves out a line the summary does not carry', () => {
    const bare = {
      ...full,
      closestGuess: { hasSubmissions: true },
    } as unknown as BlockRevealQuestionView;
    expect(
      (shownAtStep(bare, FULLY_REVEALED_STEP) as { closestGuess: unknown })
        .closestGuess,
    ).toStrictEqual({ hasSubmissions: true });
  });

  it('returns a question nobody guessed on whole at every step', () => {
    const nobody = {
      ...full,
      closestGuess: { hasSubmissions: false, closestGuesses: [] },
    } as unknown as BlockRevealQuestionView;
    expect(shownAtStep(nobody, 0)).toBe(nobody);
    expect(shownAtStep(nobody, 2)).toBe(nobody);
  });

  it('returns every other kind whole', () => {
    const other = {
      ...freeTextQuestion(3),
      revealKind: 'answer',
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    } as unknown as BlockRevealQuestionView;
    expect(shownAtStep(other, 0)).toBe(other);
  });
});

describe('closestGuessRevealDescriptor', () => {
  const walkable = {
    stepCount: FULLY_REVEALED_STEP + 1,
    atStart: 'fall_through',
    atEnd: 'fall_through',
    canStart: true,
  };
  const guessed = { hasSubmissions: true, closestGuesses: [] };

  // Round 0 (no break after) and round 1 form one block of questions 1-4;
  // round 2 is the next block, so a reveal index of 4 is past this block.
  const rounds = [
    {
      ...round(1, [1, 2], { breakAfter: false }),
      questions: [freeTextQuestion(1), closestGuessQuestion(2)],
    },
    {
      ...round(2, [3, 4]),
      questions: [closestGuessQuestion(3), closestGuessQuestion(4)],
    },
    { ...round(3, [5]), questions: [closestGuessQuestion(5)] },
  ];
  const reveal = (
    revealIndex: number,
    summaries: Record<number, typeof guessed> = {},
    status: 'reveal' | 'break' = 'reveal',
  ) =>
    closestGuessRevealDescriptor(
      sessionWith(
        rounds,
        {},
        {
          closestGuessSummaries: { 5: guessed, ...summaries },
        },
      ),
      {
        status,
        roundIndex: 1,
        questionIndex: 1,
        isLeaderboardVisible: false,
        isJoinOverlayVisible: false,
        revealIndex,
        furthestOpenIndex: 3,
      },
    );

  it('walks a closest_guess question someone guessed on, falling through at both ends', () => {
    expect(reveal(1, { 2: guessed })).toStrictEqual(walkable);
  });

  it('resolves a reveal index in the block start round and in the pinned round', () => {
    expect(reveal(3, { 4: guessed })).toStrictEqual(walkable);
    expect(reveal(1, { 4: guessed })).toBeNull();
    expect(reveal(3, { 2: guessed })).toBeNull();
  });

  it('has nothing to walk on a question of another type', () => {
    expect(reveal(0, { 1: guessed })).toBeNull();
  });

  it('has nothing to walk when nobody guessed or there is no summary', () => {
    expect(
      reveal(1, { 2: { hasSubmissions: false, closestGuesses: [] } }),
    ).toBeNull();
    expect(reveal(1)).toBeNull();
  });

  it('has nothing to walk outside the reveal status', () => {
    expect(reveal(1, { 2: guessed }, 'break')).toBeNull();
  });

  it('has nothing to walk past the last question of the block', () => {
    expect(reveal(4)).toBeNull();
  });
});
