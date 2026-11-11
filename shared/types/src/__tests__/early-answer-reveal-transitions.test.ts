import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  type GameAction,
  type GameContext,
  type GameProgress,
} from '../game-state';

// Block 1 = rounds 0-1 (2 questions each, break after round 1); block 2 = round 2.
const rounds: GameContext['rounds'] = [
  { questionCount: 2, breakAfter: false },
  { questionCount: 2, breakAfter: true },
  { questionCount: 1, breakAfter: true },
];
const early: GameContext = { rounds, earlyAnswerReveal: true };
const usual: GameContext = { rounds };

const locking: GameProgress = {
  status: 'locking',
  roundIndex: 1,
  questionIndex: 1,
  isLeaderboardVisible: false,
  isJoinOverlayVisible: false,
  revealIndex: 0,
  furthestOpenIndex: 3,
};

function press(
  progress: GameProgress,
  action: GameAction,
  context: GameContext,
): GameProgress {
  return getNextGameState(progress, action, context);
}

/** The (status, revealIndex) path of repeated ADVANCE presses from `start`, up to and including `stopAt`. */
function advancePath(
  start: GameProgress,
  context: GameContext,
  stopAt: string,
): [string, number][] {
  const path: [string, number][] = [];
  let progress = start;
  while (progress.status !== stopAt) {
    progress = press(progress, 'ADVANCE', context);
    path.push([progress.status, progress.revealIndex]);
  }
  return path;
}

describe('Early answer reveal — Move plan transitions', () => {
  it('goes from locking to the answers title card, then each answer, crossing rounds via the title card, into the break card', () => {
    expect(advancePath(locking, early, 'break_intro')).toEqual([
      ['answers_intro', 0],
      ['answers', 0],
      ['answers', 1],
      ['answers_intro', 2],
      ['answers', 2],
      ['answers', 3],
      ['break_intro', 3],
    ]);
  });

  it('keeps the usual locking -> break_intro with the setting off', () => {
    expect(press(locking, 'ADVANCE', usual)).toMatchObject({
      status: 'break_intro',
      revealIndex: 3,
    });
  });

  it('still leaves the break through the usual reveal', () => {
    const breakIntro = press(
      { ...locking, status: 'answers', revealIndex: 3 },
      'ADVANCE',
      early,
    );
    expect(press(breakIntro, 'ADVANCE', early)).toMatchObject({
      status: 'reveal_intro',
      revealIndex: 0,
    });
  });

  it('steps back through the answers mirroring the forward walk', () => {
    const atLast: GameProgress = {
      ...locking,
      status: 'answers',
      revealIndex: 3,
    };
    const back1 = press(atLast, 'PREVIOUS', early);
    const back2 = press(back1, 'PREVIOUS', early);
    const back3 = press(back2, 'PREVIOUS', early);
    expect([back1, back2, back3].map((p) => [p.status, p.revealIndex])).toEqual(
      [
        ['answers', 2],
        ['answers_intro', 2],
        ['answers', 1],
      ],
    );
  });

  it("goes from the quiz's first answers card to where Previous from the first round intro goes", () => {
    const first: GameProgress = {
      ...locking,
      status: 'answers_intro',
      revealIndex: 0,
    };
    expect(press(first, 'PREVIOUS', early)).toMatchObject({
      status: 'rules',
      roundIndex: 0,
    });
  });

  it("goes from a later block's first answers card to the previous block's break card", () => {
    const second: GameProgress = {
      ...locking,
      status: 'answers_intro',
      roundIndex: 2,
      questionIndex: 0,
      revealIndex: 0,
    };
    expect(press(second, 'PREVIOUS', early)).toMatchObject({
      status: 'break_intro',
      roundIndex: 1,
      questionIndex: 1,
      revealIndex: 3,
    });
  });
});
