import { describe, expect, it } from 'vitest';
import {
  AUTO_GRADED_TYPES,
  BATCH_GRADED_TYPES,
  HUMAN_GRADED_TYPES,
  KAHOOT_ALLOWED_TYPES,
  OVERRIDABLE_TYPES,
  gradeClosestGuessBatch,
  halfPoints,
  scoreSubmission,
  verdictForManualGrade,
  type ScoredQuestion,
} from '../scoring';

const mc: ScoredQuestion = {
  type: 'multiple_choice',
  answer: 'Paris',
  points: 10,
};

describe('scoreSubmission — exact-match types', () => {
  it.each([
    ['multiple_choice', 'Paris', 'Paris', 10, 'correct'],
    ['multiple_choice', 'paris', 'Paris', 0, 'incorrect'],
    ['sort', 'a|b|c', 'a|b|c', 10, 'correct'],
    ['sort', 'a|c|b', 'a|b|c', 0, 'incorrect'],
    ['sort', ' a | b |c ', 'a|b|c', 10, 'correct'],
    ['sort', 'a||b|c|', 'a|b|c', 10, 'correct'],
    ['sort', 'a|b', 'a|b|c', 0, 'incorrect'],
    ['free_text', 'Paris', 'Paris', 10, 'correct'],
    ['free_text', '  PARIS ', 'Paris', 10, 'correct'],
    ['free_text', 'Pari', 'Paris', 0, 'incorrect'],
  ] as const)(
    '%s: %j against %j -> %i, %s',
    (type, value, answer, points, verdict) => {
      expect(scoreSubmission({ type, answer, points: 10 }, value)).toEqual({
        points,
        verdict,
      });
    },
  );

  it.each(['audio', 'youtube', 'closest_guess'] as const)(
    'scores nothing for %s, which is not graded at submit',
    (type) => {
      expect(scoreSubmission({ type, answer: '5', points: 10 }, '5')).toEqual({
        points: 0,
        verdict: 'incorrect',
      });
    },
  );
});

describe('scoreSubmission — match', () => {
  const answer = 'a|b|c|d';
  const partial = (mode?: 'partial' | 'all_or_nothing'): ScoredQuestion => ({
    type: 'match',
    answer,
    points: 8,
    matchScoringMode: mode,
  });

  it.each([
    ['a|b|c|d', 8, 'correct'],
    ['a|b|c|x', 6, 'partial'],
    ['a|b|x|x', 4, 'partial'],
    ['x|x|x|x', 0, 'incorrect'],
  ] as const)(
    'partial mode (default): %s -> %i, %s',
    (value, points, verdict) => {
      expect(scoreSubmission(partial(), value)).toEqual({ points, verdict });
      expect(scoreSubmission(partial('partial'), value)).toEqual({
        points,
        verdict,
      });
    },
  );

  it.each([
    ['a|b|c|d', 8, 'correct'],
    ['a|b|c|x', 4, 'partial'],
    ['a|b|x|x', 0, 'incorrect'],
    ['x|x|x|x', 0, 'incorrect'],
  ] as const)('all_or_nothing: %s -> %i, %s', (value, points, verdict) => {
    expect(scoreSubmission(partial('all_or_nothing'), value)).toEqual({
      points,
      verdict,
    });
  });

  it('rounds half points in all_or_nothing', () => {
    expect(
      scoreSubmission(
        {
          type: 'match',
          answer: 'a|b',
          points: 3,
          matchScoringMode: 'all_or_nothing',
        },
        'a|x',
      ),
    ).toEqual({ points: 2, verdict: 'partial' });
  });

  it('ignores surrounding whitespace and empty items', () => {
    expect(scoreSubmission(partial(), ' a | b |c|d|').verdict).toBe('correct');
  });

  it('keeps a wrong-pair match partial even when rounding gives zero points', () => {
    expect(
      scoreSubmission(
        { type: 'match', answer: 'a|b|c|d', points: 1 },
        'a|x|x|x',
      ),
    ).toEqual({ points: 0, verdict: 'partial' });
  });
});

describe('scoreSubmission — kahoot speed', () => {
  const timerMs = 10_000;
  const speed = (responseMs: number | null) => ({ responseMs, timerMs });

  it.each([
    [0, 10],
    [5_000, 8], // 10 * 0.75 = 7.5 rounds up
    [10_000, 5],
    [25_000, 5],
    [-500, 10],
  ])('response at %ims keeps %i of 10 points', (responseMs, points) => {
    expect(scoreSubmission(mc, 'Paris', speed(responseMs))).toEqual({
      points,
      verdict: 'correct',
    });
  });

  it('applies no scaling without a timer', () => {
    expect(
      scoreSubmission(mc, 'Paris', { responseMs: 9_000, timerMs: null }),
    ).toEqual({ points: 10, verdict: 'correct' });
  });

  it('applies no scaling without a stored response time', () => {
    expect(scoreSubmission(mc, 'Paris', speed(null))).toEqual({
      points: 10,
      verdict: 'correct',
    });
  });

  it('keeps a wrong answer at zero whatever the speed', () => {
    expect(scoreSubmission(mc, 'Rome', speed(0))).toEqual({
      points: 0,
      verdict: 'incorrect',
    });
  });

  it('scales match partial credit and keeps its partial verdict', () => {
    expect(
      scoreSubmission(
        { type: 'match', answer: 'a|b', points: 10 },
        'a|x',
        speed(10_000),
      ),
    ).toEqual({ points: 3, verdict: 'partial' }); // base 5 * 0.5 = 2.5 -> 3
  });
});

describe('gradeClosestGuessBatch', () => {
  const question: ScoredQuestion = {
    type: 'closest_guess',
    answer: '100',
    points: 6,
  };

  it('awards full points to the single closest guess only', () => {
    expect(gradeClosestGuessBatch(question, ['90', '98', '120'])).toEqual([
      { points: 0, verdict: 'incorrect' },
      { points: 6, verdict: 'correct' },
      { points: 0, verdict: 'incorrect' },
    ]);
  });

  it('awards every team tied for closest, including asymmetric ties', () => {
    expect(gradeClosestGuessBatch(question, ['90', '110', '50'])).toEqual([
      { points: 6, verdict: 'correct' },
      { points: 6, verdict: 'correct' },
      { points: 0, verdict: 'incorrect' },
    ]);
  });

  it('never awards a non-numeric guess', () => {
    expect(gradeClosestGuessBatch(question, ['lots', '101'])).toEqual([
      { points: 0, verdict: 'incorrect' },
      { points: 6, verdict: 'correct' },
    ]);
  });

  it('awards nobody when every guess is non-numeric', () => {
    expect(gradeClosestGuessBatch(question, ['lots', 'n/a'])).toEqual([
      { points: 0, verdict: 'incorrect' },
      { points: 0, verdict: 'incorrect' },
    ]);
  });

  it('returns nothing for no submissions', () => {
    expect(gradeClosestGuessBatch(question, [])).toEqual([]);
  });
});

describe('verdictForManualGrade', () => {
  it.each([
    [0, 'incorrect'],
    [-1, 'incorrect'],
    [3, 'partial'],
    [10, 'correct'],
    [12, 'correct'],
  ] as const)('%i of 10 points is %s', (points, verdict) => {
    expect(verdictForManualGrade({ points: 10 }, points)).toBe(verdict);
  });
});

describe('halfPoints', () => {
  it.each([
    [4, 2],
    [3, 2],
    [1, 1],
    [0, 0],
  ])('half of %i is %i', (points, half) => {
    expect(halfPoints(points)).toBe(half);
  });
});

describe('category lists', () => {
  it('grades multiple_choice, sort, match and free_text at submit', () => {
    expect([...AUTO_GRADED_TYPES].sort()).toEqual(
      ['free_text', 'match', 'multiple_choice', 'sort'].sort(),
    );
  });

  it('batch-grades closest_guess and leaves audio/youtube to a human', () => {
    expect(BATCH_GRADED_TYPES).toEqual(['closest_guess']);
    expect([...HUMAN_GRADED_TYPES].sort()).toEqual(['audio', 'youtube']);
  });

  it('allows only multiple_choice, sort and match in kahoot rounds', () => {
    expect([...KAHOOT_ALLOWED_TYPES].sort()).toEqual(
      ['match', 'multiple_choice', 'sort'].sort(),
    );
  });

  it('auto-grades free_text without allowing it in kahoot rounds', () => {
    expect(AUTO_GRADED_TYPES).toContain('free_text');
    expect(KAHOOT_ALLOWED_TYPES).not.toContain('free_text');
  });

  it('lets everything but closest_guess be overridden by hand', () => {
    expect(OVERRIDABLE_TYPES).not.toContain('closest_guess');
    expect([...OVERRIDABLE_TYPES].sort()).toEqual(
      [
        'audio',
        'free_text',
        'match',
        'multiple_choice',
        'sort',
        'youtube',
      ].sort(),
    );
  });
});
