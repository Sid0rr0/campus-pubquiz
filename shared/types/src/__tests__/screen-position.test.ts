import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  IllegalGameTransitionError,
  type GameAction,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { planMove } from '../move-plan';
import { screenPositionOf } from '../on-air-screen';
import type { LeaderboardEntry } from '../room-views';
import { projectScreen } from '../screen-projection';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import { freshSessionState, type SessionState } from '../session-state';
import { SOCKET_ROOMS } from '../socket-events';
import { revealStepOf, stepRevealOnAir } from '../stepped-reveal';
import { lobby } from './game-state-fixtures';

/** A block spanning two rounds, a plain block, a kahoot round, and a last block; with the round overview on. */
const seededQuiz: GameContext = {
  showRoundOverview: true,
  jokersEnabled: true,
  rounds: [
    { questionCount: 2, breakAfter: false },
    { questionCount: 1, breakAfter: true },
    { questionCount: 2, breakAfter: true },
    { questionCount: 2, breakAfter: false, kahootMode: true },
    { questionCount: 1, breakAfter: true },
  ],
};

const leaderboard: LeaderboardEntry[] = ['Alpha', 'Bravo', 'Charlie'].map(
  (teamName, index) => ({
    teamId: index + 1,
    teamName,
    totalPoints: 0,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
    rank: index + 1,
    rankTo: index + 1,
  }),
);

/** The seeded quiz as a session, one free_text question per slot, at `progress`. */
function sessionAt(progress: GameProgress): SessionState {
  let nextId = 1;
  return {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        rounds: seededQuiz.rounds.map((round, roundIndex) => ({
          id: roundIndex + 1,
          title: `Round ${roundIndex + 1}`,
          breakAfter: round.breakAfter,
          kahootMode: round.kahootMode ?? false,
          questions: Array.from({ length: round.questionCount }, () => {
            const id = nextId++;
            return {
              id,
              type: 'free_text' as const,
              prompt: `Question ${id}?`,
              answer: 'x',
              points: 1000,
            };
          }),
        })),
        settings: DEFAULT_SESSION_SETTINGS,
      },
      progress,
    ),
    leaderboard,
  };
}

function positionOnDisplay(session: SessionState): number {
  return projectScreen(session, SOCKET_ROOMS.DISPLAY).screenPosition;
}

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
        'joker_pick',
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

  it('stays put on every leaderboard rank-reveal step, at every point', () => {
    for (const progress of states) {
      const covered = sessionAt({ ...progress, isLeaderboardVisible: true });
      const placeCount = leaderboard.length;
      const before = positionOnDisplay(covered);
      for (let shown = 0; shown <= placeCount; shown++) {
        const revealed = { ...covered, leaderboardRevealCount: shown };
        expect(positionOnDisplay(revealed)).toBe(before);
      }
      const step = planMove(covered, 'ADVANCE');
      if (step.kind === 'leaderboard_reveal') {
        expect(screenPositionOf(step.progress)).toBe(before);
      }
    }
  });

  it('stays put on every showdown reveal step once the quiz has ended', () => {
    const ended = states.find(({ status }) => status === 'ended')!;
    const session = {
      ...sessionAt(ended),
      activeShowdownRound: {
        id: 1,
        question: 'How many?',
        answer: '10',
        participants: [
          { teamId: 1, teamName: 'Alpha', seatIndex: 0, guess: '9' },
          { teamId: 2, teamName: 'Bravo', seatIndex: 1, guess: '12' },
        ],
        winnerTeamId: 1,
        isTie: false,
        resolved: true,
      },
    };
    const before = positionOnDisplay(session);
    expect(before).toBe(screenPositionOf(ended));
    let current = session;
    for (const action of [
      'ADVANCE',
      'ADVANCE',
      'ADVANCE',
      'PREVIOUS',
    ] as const) {
      const stepped = stepRevealOnAir(current, action);
      expect(stepped.kind).toBe('step');
      if (stepped.kind === 'step') current = stepped.session;
      expect(positionOnDisplay(current)).toBe(before);
    }
    expect(revealStepOf(current, 'showdown')).toBeGreaterThan(0);
  });

  // Closest-guess reveal steps need no test of their own: they only move
  // `revealStep`, which is not a GameProgress field, and the
  // position is a function of GameProgress alone, so it can't move for them
  // by construction.
});

describe('the screen position on the wire', () => {
  const session = sessionAt({ ...lobby, status: 'rules' });
  it('is on the display view', () => {
    expect(projectScreen(session, SOCKET_ROOMS.DISPLAY)).toHaveProperty(
      'screenPosition',
      screenPositionOf(session.progress),
    );
  });

  it('is not on the admin or players views', () => {
    expect(projectScreen(session, SOCKET_ROOMS.ADMIN)).not.toHaveProperty(
      'screenPosition',
    );
    expect(projectScreen(session, SOCKET_ROOMS.PLAYERS)).not.toHaveProperty(
      'screenPosition',
    );
  });
});
