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

  const breakIntro: GameProgress = {
    ...locking,
    status: 'break_intro',
    revealIndex: 3,
  };

  it("leaves the break for the next block's round intro with the leaderboard up", () => {
    expect(press(breakIntro, 'ADVANCE', early)).toMatchObject({
      status: 'round_intro',
      roundIndex: 2,
      questionIndex: 0,
      revealIndex: 0,
      furthestOpenIndex: -1,
      isLeaderboardVisible: true,
    });
  });

  it('leaves the last block\'s break for "ended" with the leaderboard up', () => {
    const lastBreak: GameProgress = {
      ...breakIntro,
      roundIndex: 2,
      questionIndex: 0,
      revealIndex: 0,
    };
    expect(press(lastBreak, 'ADVANCE', early)).toMatchObject({
      status: 'ended',
      previousStatus: 'break_intro',
      isLeaderboardVisible: true,
    });
  });

  it('opens the leaderboard again when the break is re-entered by Previous and left again', () => {
    const back = press(breakIntro, 'PREVIOUS', early);
    expect(back.status).toBe('break');
    expect(press(back, 'ADVANCE', early)).toMatchObject({
      status: 'round_intro',
      isLeaderboardVisible: true,
    });
  });

  it('still leaves the break through the usual reveal with the setting off', () => {
    expect(press(breakIntro, 'ADVANCE', usual)).toMatchObject({
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
