import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_ROOMS,
  type GameProgress,
  type RevealQuestionView,
} from '@campus-pubquiz/types';
import type { SeededRound } from '@/db/seed.types';
import { projectScreen } from '@/game/state/screen-projection.util';
import {
  freshSessionState,
  type SessionState,
} from '@/game/state/session-state';

function question(id: number): RevealQuestionView {
  return {
    id,
    type: 'free_text',
    prompt: `Question ${id}`,
    options: [],
    points: 1,
    answer: `Answer ${id}`,
  } as unknown as RevealQuestionView;
}

function round(
  id: number,
  questionCount: number,
  breakAfter: boolean,
): SeededRound {
  return {
    id,
    title: `Round ${id}`,
    breakAfter,
    questions: Array.from({ length: questionCount }, (_, i) =>
      question(id * 10 + i),
    ),
  };
}

function session(
  rounds: SeededRound[],
  progress: Partial<GameProgress>,
): SessionState {
  return freshSessionState(
    {
      quizId: 1,
      gameSessionId: 1,
      joinCode: 'ABCDEF',
      rounds,
      settings: DEFAULT_SESSION_SETTINGS,
    },
    {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      ...progress,
    },
  );
}

// One block of four questions spanning two rounds: ids 10, 11 | 20, 21.
const BLOCK = [round(1, 2, false), round(2, 2, true)];

function playerRevealIds(state: SessionState): number[] {
  return projectScreen(state, SOCKET_ROOMS.PLAYERS).revealQuestions.map(
    (q) => q.id,
  );
}

describe('Screen projection — players view reveal redaction', () => {
  it('carries no reveal questions in reveal_intro at the first position', () => {
    const state = session(BLOCK, { status: 'reveal_intro', revealIndex: 0 });

    expect(playerRevealIds(state)).toEqual([]);
  });

  it('carries the on-air question, with its answer, in reveal at position 0', () => {
    const view = projectScreen(
      session(BLOCK, { status: 'reveal', revealIndex: 0 }),
      SOCKET_ROOMS.PLAYERS,
    );

    expect(view.revealQuestions).toMatchObject([
      { id: 10, answer: 'Answer 10' },
    ]);
  });

  it('carries every question up to and including the on-air one in reveal at position 2', () => {
    const state = session(BLOCK, { status: 'reveal', revealIndex: 2 });

    expect(playerRevealIds(state)).toEqual([10, 11, 20]);
  });

  it('holds back the upcoming question in reveal_intro crossing into a second round, and still names that round', () => {
    const view = projectScreen(
      session(BLOCK, { status: 'reveal_intro', revealIndex: 2 }),
      SOCKET_ROOMS.PLAYERS,
    );

    expect(view.revealQuestions.map((q) => q.id)).toEqual([10, 11]);
    expect(view.phoneScreen).toEqual({ kind: 'round_title', title: 'Round 2' });
  });

  it('trims the same when the leaderboard covers the reveal', () => {
    const state = session(BLOCK, {
      status: 'reveal',
      revealIndex: 1,
      isLeaderboardVisible: true,
    });

    expect(playerRevealIds(state)).toEqual([10, 11]);
  });

  it.each([SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.ADMIN])(
    'keeps the full block in the %s view',
    (room) => {
      const view = projectScreen(
        session(BLOCK, { status: 'reveal', revealIndex: 0 }),
        room,
      );

      expect(view.revealQuestions.map((q) => q.id)).toEqual([10, 11, 20, 21]);
    },
  );

  it('keeps trimmed questions in the block questions, without their answers', () => {
    const view = projectScreen(
      session(BLOCK, { status: 'reveal', revealIndex: 0 }),
      SOCKET_ROOMS.PLAYERS,
    );

    expect(view.blockQuestions.map((q) => q.id)).toEqual([10, 11, 20, 21]);
    expect(view.blockQuestions[1]).not.toHaveProperty('answer');
  });
});
