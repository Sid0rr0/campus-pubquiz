import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  IllegalGameTransitionError,
  type GameAction,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { screenPositionOf } from '../on-air-screen';
import { lobby } from './game-state-fixtures';

/** A block spanning two rounds, a plain block, a kahoot round, and a last block; with the round overview on. */
const seededQuiz: GameContext = {
  showRoundOverview: true,
  rounds: [
    { questionCount: 2, breakAfter: false },
    { questionCount: 1, breakAfter: true },
    { questionCount: 2, breakAfter: true },
    { questionCount: 2, breakAfter: false, kahootMode: true },
    { questionCount: 1, breakAfter: true },
  ],
};

interface Edge {
  from: GameProgress;
  action: GameAction;
  to: GameProgress;
}

function tryStep(
  progress: GameProgress,
  action: GameAction,
): GameProgress | null {
  try {
    return getNextGameState(progress, action, seededQuiz);
  } catch (error) {
    if (error instanceof IllegalGameTransitionError) return null;
    throw error;
  }
}

function keyOf(progress: GameProgress): string {
  const { status, roundIndex, questionIndex, revealIndex, furthestOpenIndex } =
    progress;
  return JSON.stringify([
    status,
    roundIndex,
    questionIndex,
    revealIndex,
    furthestOpenIndex,
    progress.previousStatus ?? null,
  ]);
}

/**
 * Every move the quiz master can make from the lobby (START_QUIZ, ADVANCE,
 * PREVIOUS, END_QUIZ) with the overlays closed, found by exploring until no
 * new progress turns up. The forward walk alone never visits break review;
 * Previous from the break intro does.
 */
function exploreMoves(): { states: GameProgress[]; edges: Edge[] } {
  const states = new Map<string, GameProgress>([[keyOf(lobby), lobby]]);
  const edges: Edge[] = [];
  const queue = [lobby];
  const actions: GameAction[] = [
    'START_QUIZ',
    'ADVANCE',
    'PREVIOUS',
    'END_QUIZ',
  ];
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const action of actions) {
      const stepped = tryStep(from, action);
      if (stepped === null) continue;
      const to = { ...stepped, isLeaderboardVisible: false };
      edges.push({ from, action, to });
      if (!states.has(keyOf(to))) {
        states.set(keyOf(to), to);
        queue.push(to);
      }
    }
  }
  return { states: [...states.values()], edges };
}

describe('screenPositionOf', () => {
  const { states, edges } = exploreMoves();

  it('walks every status of a seeded quiz, break review and break round cards included', () => {
    expect(new Set(states.map((progress) => progress.status))).toEqual(
      new Set([
        'lobby',
        'rules',
        'round_overview',
        'round_intro',
        'question_open',
        'locking',
        'break_intro',
        'break',
        'break_round_intro',
        'reveal_intro',
        'reveal',
        'ended',
      ]),
    );
  });

  it('strictly grows on every START_QUIZ, ADVANCE and END_QUIZ', () => {
    const forward = edges.filter(({ action }) => action !== 'PREVIOUS');
    expect(forward.length).toBeGreaterThan(40);
    for (const { from, to } of forward) {
      expect(screenPositionOf(to)).toBeGreaterThan(screenPositionOf(from));
    }
  });

  it('strictly falls on every PREVIOUS, including onto a round intro whose questions are already open and back through the break review', () => {
    const backward = edges.filter(({ action }) => action === 'PREVIOUS');
    for (const { from, to } of backward) {
      expect(screenPositionOf(to)).toBeLessThan(screenPositionOf(from));
    }
    expect(
      backward.some(
        ({ to }) => to.status === 'round_intro' && to.furthestOpenIndex >= 0,
      ),
    ).toBe(true);
    expect(
      backward.some(
        ({ from, to }) => from.status === 'break' && to.status === 'break',
      ),
    ).toBe(true);
    expect(backward.some(({ to }) => to.status === 'break_round_intro')).toBe(
      true,
    );
  });

  it('stays put for the leaderboard, join overlay, media and pause actions at every point', () => {
    const sideActions: GameAction[] = [
      'TOGGLE_LEADERBOARD',
      'TOGGLE_JOIN_OVERLAY',
      'TOGGLE_MEDIA_FULLSCREEN',
      'REPLAY_MEDIA',
      'TOGGLE_MEDIA_PAUSE',
    ];
    for (const progress of states) {
      for (const action of sideActions) {
        const toggled = tryStep(progress, action);
        if (toggled === null) continue;
        expect(screenPositionOf(toggled)).toBe(screenPositionOf(progress));
      }
    }
  });
});
