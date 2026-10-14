import { describe, expect, it } from 'vitest';
import { describeVerdictCard } from '@/app/play/verdict-card';

describe('describeVerdictCard', () => {
  it('reads "Correct" with the points for a correct verdict, and vibrates', () => {
    const card = describeVerdictCard({
      myAnswer: 'Paris',
      pointsAwarded: 2,
      verdict: 'correct',
    });

    expect(card).toEqual({
      text: '✓ Correct +2',
      tone: 'correct',
      shouldVibrate: true,
    });
  });

  it('reads "Close!" with the actual points for a partial verdict, without vibrating', () => {
    const card = describeVerdictCard({
      myAnswer: 'a|b',
      pointsAwarded: 3,
      verdict: 'partial',
    });

    expect(card).toEqual({
      text: 'Close! +3',
      tone: 'partial',
      shouldVibrate: false,
    });
  });

  it('reads a cross and +0 for an incorrect verdict', () => {
    const card = describeVerdictCard({
      myAnswer: 'Rome',
      pointsAwarded: 0,
      verdict: 'incorrect',
    });

    expect(card).toEqual({
      text: '✗ +0',
      tone: 'incorrect',
      shouldVibrate: false,
    });
  });

  it('reads "No answer" when the team did not answer', () => {
    const card = describeVerdictCard({
      myAnswer: null,
      pointsAwarded: 0,
      verdict: null,
    });

    expect(card).toEqual({
      text: 'No answer',
      tone: 'none',
      shouldVibrate: false,
    });
  });

  it('shows fractional points as awarded', () => {
    const card = describeVerdictCard({
      myAnswer: 'a|b',
      pointsAwarded: 2.5,
      verdict: 'partial',
    });

    expect(card.text).toBe('Close! +2.5');
  });
});
