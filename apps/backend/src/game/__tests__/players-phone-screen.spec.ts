import {
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameProgress,
  type PhoneScreen,
  projectScreen,
  type SeededQuestion,
  type SeededRound,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';
import { SEEDED_GAME_SUMMARY_DEFAULTS } from '@/game/__tests__/seeded-game-defaults';

function question(id: number): SeededQuestion {
  return {
    id,
    type: 'free_text',
    prompt: `Question ${id}`,
    options: [],
    points: 1,
    answer: `Answer ${id}`,
  } as unknown as SeededQuestion;
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
      ...SEEDED_GAME_SUMMARY_DEFAULTS,
      rounds,
      settings: DEFAULT_SESSION_SETTINGS,
    },
    {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      isJoinOverlayVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      ...progress,
    },
  );
}

// One block of four questions spanning two rounds: ids 10, 11 | 20, 21.
const BLOCK = [round(1, 2, false), round(2, 2, true)];

function phoneScreen(state: SessionState): PhoneScreen {
  return projectScreen(state, SOCKET_ROOMS.PLAYERS).phoneScreen;
}

const SHOWDOWN: SessionState['activeShowdownRound'] = {
  id: 1,
  question: 'How many?',
  answer: '7',
  participants: [],
  winnerTeamId: null,
  isTie: false,
  resolved: false,
};

describe('Screen projection — the players view phone screen', () => {
  it.each(['lobby', 'rules', 'round_overview'] as const)(
    'names the %s screen',
    (status) => {
      expect(phoneScreen(session(BLOCK, { status }))).toEqual({ kind: status });
    },
  );

  it('names the leaderboard when the board is up and nothing is answerable', () => {
    const state = session(BLOCK, {
      status: 'break',
      isLeaderboardVisible: true,
    });

    expect(phoneScreen(state)).toEqual({ kind: 'leaderboard' });
  });

  it('names a fresh round intro as a round title card', () => {
    const state = session(BLOCK, {
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      furthestOpenIndex: -1,
    });

    expect(phoneScreen(state)).toEqual({
      kind: 'round_title',
      title: 'Round 1',
    });
  });

  it('keeps the block up over an open question the board covers', () => {
    const state = session(BLOCK, {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: true,
    });

    expect(phoneScreen(state)).toEqual({
      kind: 'block',
      mode: 'answering',
      onScreenQuestionId: null,
    });
  });

  it('names the leaderboard over a kahoot question still hidden behind the board', () => {
    const state = session(
      BLOCK.map((r) => ({ ...r, kahootMode: true })),
      {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: true,
      },
    );

    expect(phoneScreen(state)).toEqual({ kind: 'leaderboard' });
  });

  it('keeps the block up when Previous steps back into an already-open round intro', () => {
    const state = session(BLOCK, {
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: 3,
    });

    expect(phoneScreen(state)).toEqual({
      kind: 'block',
      mode: 'answering',
      onScreenQuestionId: null,
    });
  });

  it.each(['break_intro', 'break'] as const)(
    'names the block locked in %s, with no question on the big screen',
    (status) => {
      expect(phoneScreen(session(BLOCK, { status }))).toEqual({
        kind: 'block',
        mode: 'locked',
        onScreenQuestionId: null,
      });
    },
  );

  it('names the block locked in break review when the round title is unknown', () => {
    const state = session(BLOCK, {
      status: 'break_round_intro',
      revealIndex: 99,
    });

    expect(phoneScreen(state)).toEqual({
      kind: 'block',
      mode: 'locked',
      onScreenQuestionId: null,
    });
  });

  it('names the block revealing in a reveal intro whose round title is unknown', () => {
    const state = session(BLOCK, { status: 'reveal_intro', revealIndex: 99 });

    expect(phoneScreen(state)).toEqual({
      kind: 'block',
      mode: 'revealing',
      onScreenQuestionId: null,
    });
  });

  it('names the round title card when break steps through a round intro', () => {
    const state = session(BLOCK, {
      status: 'break_round_intro',
      revealIndex: 2,
    });

    expect(phoneScreen(state)).toEqual({
      kind: 'round_title',
      title: 'Round 2',
    });
  });

  it('names the round title card in a reveal_intro crossing into a new round', () => {
    const state = session(BLOCK, { status: 'reveal_intro', revealIndex: 2 });

    expect(phoneScreen(state)).toEqual({
      kind: 'round_title',
      title: 'Round 2',
    });
  });

  it('names the block, carrying the revealed question, in reveal', () => {
    const state = session(BLOCK, { status: 'reveal', revealIndex: 2 });

    expect(phoneScreen(state)).toEqual({
      kind: 'block',
      mode: 'revealing',
      onScreenQuestionId: 20,
    });
  });

  it('names the leaderboard over a title card the board covers', () => {
    const state = session(BLOCK, {
      status: 'reveal_intro',
      revealIndex: 2,
      isLeaderboardVisible: true,
    });

    expect(phoneScreen(state)).toEqual({ kind: 'leaderboard' });
  });

  it('names ended when there is no showdown', () => {
    expect(phoneScreen(session(BLOCK, { status: 'ended' }))).toEqual({
      kind: 'ended',
    });
  });

  it('names showdown_guessing at reveal step 0 and showdown_reveal above it', () => {
    const ended = session(BLOCK, { status: 'ended' });

    expect(
      phoneScreen({
        ...ended,
        activeShowdownRound: SHOWDOWN,
        revealStep: 0,
      }),
    ).toEqual({ kind: 'showdown_guessing' });
    expect(
      phoneScreen({
        ...ended,
        activeShowdownRound: SHOWDOWN,
        revealStep: 1,
      }),
    ).toEqual({ kind: 'showdown_reveal' });
  });
});
