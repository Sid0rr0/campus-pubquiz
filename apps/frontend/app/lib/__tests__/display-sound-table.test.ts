import { describe, expect, it } from 'vitest';
import type { DisplayScreen } from '@campus-pubquiz/types';
import { soundFor } from '@/app/lib/display-sound-table';

// Only `kind` matters to the table; the rest of each screen is irrelevant.
function screen(kind: DisplayScreen['kind']): DisplayScreen {
  return { kind } as DisplayScreen;
}

describe('soundFor', () => {
  it('plays the sting on a move onto a round intro', () => {
    expect(soundFor(screen('round_overview'), screen('round_title'))).toBe(
      'sting',
    );
  });

  it('plays the reveal sting on a move onto a revealed answer', () => {
    expect(soundFor(screen('reveal_intro'), screen('reveal'))).toBe('reveal');
  });

  it('plays the reveal sting between two reveals', () => {
    expect(soundFor(screen('reveal'), screen('reveal'))).toBe('reveal');
  });

  it.each([
    'break_intro',
    'break_review',
    'break_round_title',
    'reveal_intro',
  ] as const)('plays time-up from locking onto %s', (next) => {
    expect(soundFor(screen('locking'), screen(next))).toBe('timeUp');
  });

  it('plays time-up from a question straight onto a screen after the lock', () => {
    expect(soundFor(screen('question'), screen('break_intro'))).toBe('timeUp');
  });

  it('plays the fanfare on a move onto the ended screen', () => {
    expect(soundFor(screen('reveal'), screen('ended'))).toBe('fanfare');
  });

  it.each([
    ['question', 'question'],
    ['question', 'locking'],
    ['locking', 'locking'],
    ['break_intro', 'break_review'],
    ['break_review', 'break_round_title'],
    ['break_intro', 'break_round_title'],
    ['break_round_title', 'reveal_intro'],
    ['round_title', 'question'],
    ['lobby', 'rules'],
    ['question', 'leaderboard'],
    ['locking', 'join_overlay'],
    ['leaderboard', 'break_intro'],
    ['question', 'join_overlay'],
  ] as const)('plays nothing from %s to %s', (previous, next) => {
    expect(soundFor(screen(previous), screen(next))).toBeNull();
  });
});
