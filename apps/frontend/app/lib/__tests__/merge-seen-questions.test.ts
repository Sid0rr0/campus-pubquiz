import type { PlayersStatePayload } from '@campus-pubquiz/types';
import { describe, expect, it } from 'vitest';
import { mergeSeenQuestions } from '@/app/lib/use-player-game';

const hidden = {
  id: 1,
  type: 'free_text' as const,
  prompt: 'Name a fruit',
  points: 1,
  roundNumber: 1,
  questionNumberInRound: 1,
  roundTitle: 'Round 1',
};
const revealed = { ...hidden, answer: 'Banana' };

function payload(overrides: Partial<PlayersStatePayload>): PlayersStatePayload {
  return {
    blockQuestions: [],
    revealQuestions: [],
    pastRevealedQuestions: [],
    ...overrides,
  } as PlayersStatePayload;
}

describe('mergeSeenQuestions', () => {
  it('takes a question’s answer once the reveal walk reaches it', () => {
    const before = mergeSeenQuestions(
      {},
      payload({ blockQuestions: [hidden] }),
    );

    const after = mergeSeenQuestions(
      before,
      payload({ blockQuestions: [hidden], revealQuestions: [revealed] }),
    );

    expect(after[1]).toEqual(revealed);
  });

  it('drops the answer again when the walk steps back past the question', () => {
    const revealedSoFar = mergeSeenQuestions(
      {},
      payload({ blockQuestions: [hidden], revealQuestions: [revealed] }),
    );

    const afterPrevious = mergeSeenQuestions(
      revealedSoFar,
      payload({ blockQuestions: [hidden], revealQuestions: [] }),
    );

    expect(afterPrevious[1]).toEqual(hidden);
  });

  it('gives a fresh phone the final block’s answers from an ended snapshot', () => {
    const seen = mergeSeenQuestions(
      {},
      payload({
        progress: { status: 'ended' } as PlayersStatePayload['progress'],
        blockQuestions: [hidden],
        revealQuestions: [revealed],
      }),
    );

    expect(seen[1]).toEqual(revealed);
  });
});
