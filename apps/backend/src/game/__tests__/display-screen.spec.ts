import {
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type DisplayScreen,
  type GameProgress,
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

// Two blocks of one round each, so the quiz has two breaks: ids 10 | 20.
const ROUNDS: SeededRound[] = [
  {
    id: 1,
    title: 'Alpha',
    category: 'Science',
    author: 'Ada',
    note: 'Pens down',
    showNoteOnScreen: true,
    breakAfter: true,
    questions: [question(10)],
  },
  { id: 2, title: 'Beta', breakAfter: true, questions: [question(20)] },
];

function session(
  progress: Partial<GameProgress>,
  overrides: Partial<SessionState> = {},
): SessionState {
  return {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        ...SEEDED_GAME_SUMMARY_DEFAULTS,
        rounds: ROUNDS,
        settings: DEFAULT_SESSION_SETTINGS,
      },
      {
        status: 'lobby',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
        isJoinOverlayVisible: false,
        revealIndex: 0,
        furthestOpenIndex: 0,
        ...progress,
      },
    ),
    ...overrides,
  };
}

function screenOf(
  state: SessionState,
  onBlankScreen?: () => void,
): DisplayScreen {
  return projectScreen(state, SOCKET_ROOMS.DISPLAY, { onBlankScreen }).screen;
}

describe('Screen projection — the Display screen', () => {
  it.each(['lobby', 'rules', 'round_overview'] as const)(
    'names the %s screen with nothing more',
    (status) => {
      expect(screenOf(session({ status }))).toEqual({ kind: status });
    },
  );

  it('carries the round number, title, category, author and note on the round title card', () => {
    expect(screenOf(session({ status: 'round_intro' }))).toEqual({
      kind: 'round_title',
      roundNumber: 1,
      title: 'Alpha',
      category: 'Science',
      author: 'Ada',
      note: 'Pens down',
    });
  });

  it('leaves category, author and note empty for a round that has none', () => {
    expect(screenOf(session({ status: 'round_intro', roundIndex: 1 }))).toEqual(
      {
        kind: 'round_title',
        roundNumber: 2,
        title: 'Beta',
        category: '',
        author: '',
        note: '',
      },
    );
  });

  it('carries the open question on the question screen', () => {
    expect(
      screenOf(session({ status: 'question_open', furthestOpenIndex: 0 })),
    ).toMatchObject({
      kind: 'question',
      question: { id: 10, prompt: 'Question 10' },
    });
  });

  it('carries the lock deadline on the locking screen', () => {
    expect(
      screenOf(session({ status: 'locking' }, { questionLockAt: 5000 })),
    ).toEqual({ kind: 'locking', lockAt: 5000 });
  });

  describe('the break intro', () => {
    it('carries the first break as a break with bonus categories still to earn', () => {
      expect(
        screenOf(session({ status: 'break_intro' }, { breakEndsAt: 9000 })),
      ).toMatchObject({
        kind: 'break_intro',
        roundNumber: 1,
        breakNumber: 1,
        isFinalBreak: false,
        isFeedbackPromptShown: DEFAULT_SESSION_SETTINGS.collectFeedback,
        breakEndsAt: 9000,
      });
    });

    it('carries the last break as the final one', () => {
      expect(
        screenOf(session({ status: 'break_intro', roundIndex: 1 })),
      ).toMatchObject({
        kind: 'break_intro',
        roundNumber: 2,
        breakNumber: 2,
        isFinalBreak: true,
      });
    });
  });

  it('carries the block question under review on the break review screen', () => {
    expect(
      screenOf(session({ status: 'break', revealIndex: 0 })),
    ).toMatchObject({ kind: 'break_review', question: { id: 10 } });
  });

  it('carries the round being stepped across on the break round title', () => {
    expect(screenOf(session({ status: 'break_round_intro' }))).toEqual({
      kind: 'break_round_title',
      roundNumber: 1,
      title: 'Alpha',
      note: 'Pens down',
    });
  });

  it('carries the round about to be revealed on the reveal intro', () => {
    expect(screenOf(session({ status: 'reveal_intro' }))).toEqual({
      kind: 'reveal_intro',
      roundNumber: 1,
      title: 'Alpha',
    });
  });

  it('carries the revealed question on the reveal screen', () => {
    expect(
      screenOf(session({ status: 'reveal', revealIndex: 0 })),
    ).toMatchObject({
      kind: 'reveal',
      question: { id: 10, answer: 'Answer 10' },
    });
  });

  describe('the leaderboard', () => {
    const board = { isLeaderboardVisible: true } as const;

    it('is not final in an earlier break', () => {
      expect(
        screenOf(session({ status: 'break_intro', ...board })),
      ).toMatchObject({ kind: 'leaderboard', isFinal: false });
    });

    it('is final in the last break', () => {
      expect(
        screenOf(session({ status: 'break_intro', roundIndex: 1, ...board })),
      ).toMatchObject({ kind: 'leaderboard', isFinal: true });
    });

    it('is final once the quiz has ended, and carries its reveal count', () => {
      expect(
        screenOf(
          session({ status: 'ended', ...board }, { leaderboardRevealCount: 2 }),
        ),
      ).toMatchObject({ kind: 'leaderboard', isFinal: true, revealCount: 2 });
    });

    it('is not final over an ordinary question', () => {
      expect(
        screenOf(session({ status: 'question_open', ...board })),
      ).toMatchObject({ kind: 'leaderboard', isFinal: false });
    });
  });

  it('carries the feedback prompt flag on the ended screen', () => {
    expect(screenOf(session({ status: 'ended' }))).toEqual({
      kind: 'ended',
      isFeedbackPromptShown: DEFAULT_SESSION_SETTINGS.collectFeedback,
    });
  });

  it('carries the active showdown and its reveal step on the showdown screen', () => {
    const state = session(
      { status: 'ended' },
      {
        activeShowdownRound: {
          id: 4,
          question: 'How many?',
          answer: '7',
          participants: [],
          winnerTeamId: null,
          isTie: false,
          resolved: false,
        },
        revealStep: 1,
      },
    );

    expect(screenOf(state)).toMatchObject({
      kind: 'showdown',
      showdown: { id: 4 },
      step: 1,
    });
  });

  it('names the join overlay with nothing more', () => {
    expect(
      screenOf(
        session({ status: 'question_open', isJoinOverlayVisible: true }),
      ),
    ).toEqual({ kind: 'join_overlay' });
  });

  describe('when the content cannot be found', () => {
    it('sends blank for a reveal whose question is not in the block, and reports it', () => {
      const onBlankScreen = jest.fn();

      const screen = screenOf(
        session({ status: 'reveal', revealIndex: 7 }),
        onBlankScreen,
      );

      expect(screen).toEqual({ kind: 'blank' });
      expect(onBlankScreen).toHaveBeenCalledWith({
        kind: 'reveal',
        roundIndex: null,
        questionId: null,
      });
    });

    it('sends blank for a reveal intro and a break round title with no question behind them', () => {
      expect(
        screenOf(session({ status: 'reveal_intro', revealIndex: 7 })),
      ).toEqual({ kind: 'blank' });
      expect(
        screenOf(session({ status: 'break_round_intro', revealIndex: 7 })),
      ).toEqual({ kind: 'blank' });
    });

    it('does not report a screen it could resolve', () => {
      const onBlankScreen = jest.fn();

      screenOf(session({ status: 'reveal', revealIndex: 0 }), onBlankScreen);

      expect(onBlankScreen).not.toHaveBeenCalled();
    });
  });

  it('does not send the content a Display screen carries a second time', () => {
    const view = projectScreen(
      session({ status: 'reveal', revealIndex: 0 }),
      SOCKET_ROOMS.DISPLAY,
    );

    for (const moved of [
      'onAirScreen',
      'currentQuestion',
      'blockQuestions',
      'revealQuestions',
      'activeShowdown',
      'showdownRevealStep',
      'leaderboardBoard',
      'leaderboardRevealCount',
      'funFacts',
      'breakEndsAt',
      'roundNote',
      'roundCategory',
      'roundAuthor',
    ]) {
      expect(view).not.toHaveProperty(moved);
    }
  });

  it('keeps the On-air screen in the admin view', () => {
    expect(
      projectScreen(session({ status: 'round_intro' }), SOCKET_ROOMS.ADMIN)
        .onAirScreen,
    ).toEqual({ kind: 'round_title', roundIndex: 0 });
  });
});
