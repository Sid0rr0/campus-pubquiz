import { describe, expect, it } from 'vitest';
import type {
  QuizStructureSummary,
  TeamBonusAwardView,
} from '@campus-pubquiz/types';
import {
  formatBonusAwardConfirmation,
  formatBonusAwardToast,
  formatSignedPoints,
  getBonusEarnDeadlineText,
} from '@/app/lib/bonus-categories';

// Only the fields the formatter reads; the rest of an award is irrelevant.
function award(
  fields: Pick<TeamBonusAwardView, 'category' | 'points'> & {
    reason?: string | null;
  },
): TeamBonusAwardView {
  return fields as TeamBonusAwardView;
}

describe('formatSignedPoints', () => {
  it('signs positive points with a plus, zero included', () => {
    expect(formatSignedPoints(1)).toBe('+1');
    expect(formatSignedPoints(0.5)).toBe('+0.5');
    expect(formatSignedPoints(0)).toBe('+0');
  });

  it('writes negative points with a real minus sign', () => {
    expect(formatSignedPoints(-1)).toBe('−1');
    expect(formatSignedPoints(-2.5)).toBe('−2.5');
  });
});

describe('formatBonusAwardToast', () => {
  it('uses the singular for exactly one point, either sign', () => {
    expect(
      formatBonusAwardToast(award({ category: 'selfie', points: 1 })),
    ).toBe('+1 point — Selfie');
    expect(
      formatBonusAwardToast(award({ category: 'custom', points: -1 })),
    ).toBe('−1 point — Custom');
  });

  it('uses the plural for any other amount', () => {
    expect(formatBonusAwardToast(award({ category: 'shot', points: 2 }))).toBe(
      '+2 points — Shot',
    );
    expect(formatBonusAwardToast(award({ category: 'shot', points: 0 }))).toBe(
      '+0 points — Shot',
    );
  });

  it('adds the reason after the category label', () => {
    expect(
      formatBonusAwardToast(
        award({ category: 'custom', points: -1, reason: 'phone use' }),
      ),
    ).toBe('−1 point — Custom: phone use');
  });
});

describe('formatBonusAwardConfirmation', () => {
  it('names the signed points, the category and the team', () => {
    expect(formatBonusAwardConfirmation('selfie', 1, 'The Quizzly Bears')).toBe(
      '+1 Selfie → The Quizzly Bears',
    );
  });
});

describe('getBonusEarnDeadlineText', () => {
  function structure(blockCount: number): QuizStructureSummary {
    return { blockCount } as QuizStructureSummary;
  }

  it('closes bonuses at the end of the second-to-last break', () => {
    expect(getBonusEarnDeadlineText(structure(4))).toBe(
      'Bonus points can be earned until the end of break 3.',
    );
    expect(getBonusEarnDeadlineText(structure(2))).toBe(
      'Bonus points can be earned until the end of break 1.',
    );
  });

  it('clamps to break 1 for a single-block quiz', () => {
    expect(getBonusEarnDeadlineText(structure(1))).toBe(
      'Bonus points can be earned until the end of break 1.',
    );
  });
});
