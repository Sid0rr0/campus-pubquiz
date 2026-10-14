import { describe, expect, it } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import { revealPosition } from '@/app/lib/reveal-position';

function at(overrides: Partial<GameProgress>): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    isJoinOverlayVisible: false,
    revealIndex: 0,
    furthestOpenIndex: -1,
    ...overrides,
  };
}

describe('revealPosition', () => {
  it('grows through a forward walk from a block to the next block', () => {
    const walk = [
      at({ status: 'question_open', roundIndex: 0, questionIndex: 1 }),
      at({ status: 'break', roundIndex: 0, questionIndex: 1, revealIndex: 1 }),
      at({
        status: 'reveal_intro',
        roundIndex: 0,
        questionIndex: 1,
        revealIndex: 0,
      }),
      at({ status: 'reveal', roundIndex: 0, questionIndex: 1, revealIndex: 0 }),
      at({
        status: 'reveal_intro',
        roundIndex: 0,
        questionIndex: 1,
        revealIndex: 1,
      }),
      at({ status: 'reveal', roundIndex: 0, questionIndex: 1, revealIndex: 1 }),
      at({ status: 'round_intro', roundIndex: 1, questionIndex: 0 }),
      at({ status: 'question_open', roundIndex: 1, questionIndex: 0 }),
    ];

    const positions = walk.map(revealPosition);

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // Every step into a reveal (index 3 and 5 of the walk) is a real move forward.
    expect(positions[3]).toBeGreaterThan(positions[2]);
    expect(positions[5]).toBeGreaterThan(positions[4]);
    expect(positions[4]).toBeGreaterThan(positions[3]);
  });

  it('puts ended after the last reveal of a quiz, so Previous from it goes down', () => {
    const lastReveal = at({
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      revealIndex: 2,
    });
    const ended = { ...lastReveal, status: 'ended' as const };

    expect(revealPosition(ended)).toBeGreaterThan(revealPosition(lastReveal));
  });

  it('ignores the leaderboard flag and a closest_guess step (progress does not carry one)', () => {
    const base = at({ status: 'reveal', revealIndex: 2 });

    expect(revealPosition({ ...base, isLeaderboardVisible: true })).toBe(
      revealPosition(base),
    );
  });
});
