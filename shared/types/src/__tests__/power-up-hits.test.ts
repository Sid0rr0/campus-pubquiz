import { describe, expect, it } from 'vitest';
import { powerUpHits } from '../power-up-hits';

const POINTS = new Map([
  [1, 2],
  [2, 4],
]);

describe('powerUpHits', () => {
  it('credits each use by its team’s answer: correct in full, partial by its points’ share, missing as a miss', () => {
    expect(
      powerUpHits(
        [
          { teamId: 1, powerUp: 'first_letter', questionId: 1 },
          { teamId: 2, powerUp: 'first_letter', questionId: 2 },
          { teamId: 3, powerUp: 'first_letter', questionId: 2 },
        ],
        [
          { teamId: 1, questionId: 1, verdict: 'correct', pointsAwarded: 2 },
          { teamId: 2, questionId: 2, verdict: 'partial', pointsAwarded: 1 },
          // Team 3's answer is to another question: its use is a miss.
          { teamId: 3, questionId: 1, verdict: 'correct', pointsAwarded: 2 },
        ],
        POINTS,
      ),
    ).toEqual([{ powerUp: 'first_letter', uses: 3, hits: 1.25 }]);
  });

  it('lists question power-ups in power-up order and leaves out the extra joker and unused ones', () => {
    expect(
      powerUpHits(
        [
          { teamId: 1, powerUp: 'letter_count', questionId: 1 },
          { teamId: 1, powerUp: 'extra_joker', questionId: null },
          { teamId: 1, powerUp: 'fifty_fifty', questionId: 1 },
        ],
        [],
        POINTS,
      ),
    ).toEqual([
      { powerUp: 'fifty_fifty', uses: 1, hits: 0 },
      { powerUp: 'letter_count', uses: 1, hits: 0 },
    ]);
  });
});
