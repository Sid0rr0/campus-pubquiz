import {
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameProgress,
  type GameStatus,
  projectScreen,
  type RevealQuestionView,
  type SeededRound,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';

function question(id: number): RevealQuestionView {
  return {
    id,
    type: 'free_text',
    prompt: `Question ${id}`,
    options: [],
    points: 1,
    answer: 'A',
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
  ungradedQuestionIds: number[] = [],
): SessionState {
  const base: GameProgress = {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...progress,
  };
  return {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        rounds,
        settings: DEFAULT_SESSION_SETTINGS,
      },
      base,
    ),
    ungradedQuestionIds,
  };
}

function admin(state: SessionState) {
  return projectScreen(state, SOCKET_ROOMS.ADMIN);
}

// Round 0 has a break after its second question; round 1 is the final round.
const ROUNDS = [round(1, 3, true), round(2, 2, true)];

describe('Screen projection — isShowdownEligible (admin view)', () => {
  const GRADED: GameStatus[] = [
    'break_intro',
    'break',
    'break_round_intro',
    'reveal_intro',
    'reveal',
    'ended',
  ];

  it.each(GRADED)(
    'is true in %s on the final round with nothing ungraded',
    (status) => {
      const view = admin(session(ROUNDS, { status, roundIndex: 1 }));

      expect(view.isShowdownEligible).toBe(true);
    },
  );

  it.each([
    'lobby',
    'rules',
    'round_intro',
    'question_open',
    'locking',
  ] as GameStatus[])(
    'is false in the ungraded status %s even on the final round',
    (status) => {
      const view = admin(session(ROUNDS, { status, roundIndex: 1 }));

      expect(view.isShowdownEligible).toBe(false);
    },
  );

  it('is false when not on the final round', () => {
    const view = admin(session(ROUNDS, { status: 'break', roundIndex: 0 }));

    expect(view.isShowdownEligible).toBe(false);
  });

  it('is false while questions are still ungraded', () => {
    const view = admin(
      session(ROUNDS, { status: 'break', roundIndex: 1 }, [20]),
    );

    expect(view.isShowdownEligible).toBe(false);
  });
});

describe('Screen projection — isLastQuestionBeforeBreak (admin view)', () => {
  it.each(['question_open', 'locking'] as GameStatus[])(
    "is true at the block's last question in %s",
    (status) => {
      const view = admin(
        session(ROUNDS, { status, roundIndex: 0, questionIndex: 2 }),
      );

      expect(view.isLastQuestionBeforeBreak).toBe(true);
    },
  );

  it.each(['question_open', 'locking'] as GameStatus[])(
    'is false mid-block in %s',
    (status) => {
      const view = admin(
        session(ROUNDS, { status, roundIndex: 0, questionIndex: 1 }),
      );

      expect(view.isLastQuestionBeforeBreak).toBe(false);
    },
  );

  it('is false at a break point when no question is open or locking', () => {
    const view = admin(
      session(ROUNDS, { status: 'break', roundIndex: 0, questionIndex: 2 }),
    );

    expect(view.isLastQuestionBeforeBreak).toBe(false);
  });

  it('is false at the last question of a round with no break after it', () => {
    const view = admin(
      session([round(1, 2, false), round(2, 2, true)], {
        roundIndex: 0,
        questionIndex: 1,
      }),
    );

    expect(view.isLastQuestionBeforeBreak).toBe(false);
  });
});

describe('Screen projection — break/showdown flags are admin-only', () => {
  it.each([SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.PLAYERS])(
    'omits both flags from the %s view',
    (room) => {
      const view = projectScreen(session(ROUNDS, { roundIndex: 1 }), room);

      expect(view).not.toHaveProperty('isShowdownEligible');
      expect(view).not.toHaveProperty('isLastQuestionBeforeBreak');
    },
  );
});
