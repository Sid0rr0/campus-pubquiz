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
    expect(back.status).toBe('answers');
    expect(
      press(press(back, 'ADVANCE', early), 'ADVANCE', early),
    ).toMatchObject({
      status: 'round_intro',
      isLeaderboardVisible: true,
    });
  });

  it("steps back from the break card to the block's last answer, not the break review", () => {
    expect(press(breakIntro, 'PREVIOUS', early)).toMatchObject({
      status: 'answers',
      revealIndex: 3,
    });
    expect(press(breakIntro, 'PREVIOUS', usual).status).toBe('break');
  });

  const nextRoundIntro: GameProgress = {
    ...locking,
    status: 'round_intro',
    roundIndex: 2,
    questionIndex: 0,
    revealIndex: 0,
    furthestOpenIndex: -1,
    isLeaderboardVisible: true,
  };

  it("steps back from the next block's round intro to the break card, leaderboard hidden", () => {
    expect(press(nextRoundIntro, 'PREVIOUS', early)).toMatchObject({
      status: 'break_intro',
      roundIndex: 1,
      questionIndex: 1,
      revealIndex: 3,
      isLeaderboardVisible: false,
    });
    expect(press(nextRoundIntro, 'PREVIOUS', usual).status).toBe('reveal');
  });

  it('hides the leaderboard when Previous leaves the final screen for the break card', () => {
    const ended: GameProgress = {
      ...breakIntro,
      status: 'ended',
      previousStatus: 'break_intro',
      isLeaderboardVisible: true,
    };
    expect(press(ended, 'PREVIOUS', early)).toMatchObject({
      status: 'break_intro',
      isLeaderboardVisible: false,
    });
  });

  it('lands on the same screens walking forward, all the way back, and forward again', () => {
    const screens = (p: GameProgress) => [
      p.status,
      p.roundIndex,
      p.revealIndex,
      p.isLeaderboardVisible,
    ];
    // A locked block never reopens, so the walk starts at the answers title card.
    const forward: GameProgress[] = [];
    let p = press(locking, 'ADVANCE', early);
    while (p.status !== 'round_intro') {
      forward.push(p);
      p = press(p, 'ADVANCE', early);
    }
    forward.push(p);
    const presses = forward.length - 1;
    let back = p;
    for (let i = 0; i < presses; i++) back = press(back, 'PREVIOUS', early);
    expect(screens(back)).toEqual(screens(forward[0]));
    for (let i = 0; i < presses; i++) {
      back = press(back, 'ADVANCE', early);
      expect(screens(back)).toEqual(screens(forward[i + 1]));
    }
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
      furthestOpenIndex: -1,
      isLeaderboardVisible: false,
    });
  });

  it('lands in the quickfire reveal, not the break card, from the block after a quickfire block', () => {
    const quickfireThenBlock: GameContext = {
      earlyAnswerReveal: true,
      rounds: [
        { questionCount: 2, breakAfter: true, quickfire: true },
        { questionCount: 1, breakAfter: true },
      ],
    };
    const second: GameProgress = {
      ...locking,
      status: 'answers_intro',
      roundIndex: 1,
      questionIndex: 0,
      revealIndex: 0,
    };
    expect(press(second, 'PREVIOUS', quickfireThenBlock)).toMatchObject({
      status: 'reveal',
      roundIndex: 0,
      questionIndex: 1,
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
