import {
  type ClosestGuessRevealData,
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameProgress,
  projectScreen,
  type SeededQuestion,
  type SeededRound,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';

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

  it('keeps the full block in the admin view', () => {
    const view = projectScreen(
      session(BLOCK, { status: 'reveal', revealIndex: 0 }),
      SOCKET_ROOMS.ADMIN,
    );

    expect(view.revealQuestions.map((q) => q.id)).toEqual([10, 11, 20, 21]);
  });

  it('keeps trimmed questions in the block questions, without their answers', () => {
    const view = projectScreen(
      session(BLOCK, { status: 'reveal', revealIndex: 0 }),
      SOCKET_ROOMS.PLAYERS,
    );

    expect(view.blockQuestions.map((q) => q.id)).toEqual([10, 11, 20, 21]);
    expect(view.blockQuestions[1]).not.toHaveProperty('answer');
  });
});

describe('Screen projection — players view after the quiz ends', () => {
  const ended = (progress: Partial<GameProgress>) =>
    session(BLOCK, {
      status: 'ended',
      isLeaderboardVisible: true,
      ...progress,
    });

  it('carries the whole final block when the last reveal was advanced past', () => {
    const state = ended({ previousStatus: 'reveal', revealIndex: 3 });

    expect(playerRevealIds(state)).toEqual([10, 11, 20, 21]);
  });

  it('carries the walk up to the on-air question when End Quiz was pressed in reveal', () => {
    const state = ended({ previousStatus: 'reveal', revealIndex: 1 });

    expect(playerRevealIds(state)).toEqual([10, 11]);
  });

  it('carries the walk before the title card when End Quiz was pressed in reveal_intro', () => {
    const state = ended({ previousStatus: 'reveal_intro', revealIndex: 2 });

    expect(playerRevealIds(state)).toEqual([10, 11]);
  });

  it.each(['question_open', 'break', 'locking'] as const)(
    'carries nothing when End Quiz was pressed from %s',
    (previousStatus) => {
      const state = ended({ previousStatus, revealIndex: 2 });

      expect(playerRevealIds(state)).toEqual([]);
    },
  );

  it('carries nothing for a legacy ended session with no previous status', () => {
    expect(playerRevealIds(ended({ previousStatus: null }))).toEqual([]);
  });

  it('is not changed by an active showdown', () => {
    const state = {
      ...ended({ previousStatus: 'reveal', revealIndex: 3 }),
      activeShowdownRound: {
        id: 1,
        question: 'Tie-break?',
        answer: '42',
        participants: [],
        winnerTeamId: null,
        isTie: false,
        resolved: false,
      },
    };

    expect(playerRevealIds(state)).toEqual([10, 11, 20, 21]);
  });

  it('goes back to the normal reveal trim after Previous', () => {
    const state = session(BLOCK, { status: 'reveal', revealIndex: 3 });

    expect(playerRevealIds(state)).toEqual([10, 11, 20, 21]);
    expect(
      playerRevealIds({
        ...state,
        progress: { ...state.progress, revealIndex: 1 },
      }),
    ).toEqual([10, 11]);
  });
});

describe('Screen projection — players view closest-guess steps', () => {
  const SUMMARY = {
    hasSubmissions: true,
    minGuess: '10',
    maxGuess: '90',
    closestGuesses: [{ teamName: 'Team A', value: '50' }],
  };

  function closestGuessQuestion(id: number): SeededQuestion {
    return {
      ...question(id),
      type: 'closest_guess',
      answer: '55',
      answerMediaUrl: 'https://example.com/answer.png',
    } as unknown as SeededQuestion;
  }

  function closestGuessSession(
    step: number,
    summary: ClosestGuessRevealData = SUMMARY,
    progress: Partial<GameProgress> = {},
  ): SessionState {
    const rounds: SeededRound[] = [
      {
        id: 1,
        title: 'Round 1',
        breakAfter: true,
        questions: [closestGuessQuestion(10), closestGuessQuestion(11)],
      },
    ];
    return {
      ...session(rounds, { roundIndex: 0, questionIndex: 1, ...progress }),
      revealStep: step,
      closestGuessSummaries: { 10: summary, 11: summary },
    };
  }

  function onAir(state: SessionState) {
    const revealed = projectScreen(state, SOCKET_ROOMS.PLAYERS).revealQuestions;
    return revealed[revealed.length - 1];
  }

  it('carries no answer and no stats at step 0', () => {
    const q = onAir(closestGuessSession(0));

    expect(q).not.toHaveProperty('answer');
    expect(q).not.toHaveProperty('answerMediaUrl');
    expect(q).toMatchObject({ revealKind: 'closest_guess_pending' });
    expect(q).toHaveProperty('closestGuess', { hasSubmissions: true });
  });

  it('carries the lowest guess only at step 1', () => {
    const q = onAir(closestGuessSession(1));

    expect(q).not.toHaveProperty('answer');
    expect(q).toMatchObject({ revealKind: 'closest_guess_pending' });
    expect(q).toHaveProperty('closestGuess', {
      hasSubmissions: true,
      minGuess: '10',
    });
  });

  it('carries the lowest and highest guesses at step 2', () => {
    const q = onAir(closestGuessSession(2));

    expect(q).not.toHaveProperty('answer');
    expect(q).toMatchObject({ revealKind: 'closest_guess_pending' });
    expect(q).toHaveProperty('closestGuess', {
      hasSubmissions: true,
      minGuess: '10',
      maxGuess: '90',
    });
  });

  it('adds the answer and its media at step 3, still without the closest teams', () => {
    const q = onAir(closestGuessSession(3));

    expect(q).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
      answerMediaUrl: 'https://example.com/answer.png',
    });
    expect(q).not.toHaveProperty('closestGuess.closestGuesses');
  });

  it('carries everything at step 4', () => {
    const q = onAir(closestGuessSession(4));

    expect(q).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
      closestGuess: SUMMARY,
    });
  });

  it('removes the later fields again when Previous steps back', () => {
    expect(onAir(closestGuessSession(4))).toHaveProperty(
      'closestGuess.maxGuess',
      '90',
    );
    expect(onAir(closestGuessSession(1))).not.toHaveProperty(
      'closestGuess.maxGuess',
    );
  });

  it('carries the answer straight away when nobody submitted', () => {
    const summary = { hasSubmissions: false, closestGuesses: [] };

    expect(onAir(closestGuessSession(0, summary))).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
      closestGuess: summary,
    });
  });

  it('leaves earlier closest-guess questions in the walk complete at step 0', () => {
    const view = projectScreen(
      closestGuessSession(0, SUMMARY, { revealIndex: 1 }),
      SOCKET_ROOMS.PLAYERS,
    );

    expect(view.revealQuestions[0]).toMatchObject({
      id: 10,
      revealKind: 'closest_guess',
      answer: '55',
      closestGuess: SUMMARY,
    });
    expect(view.revealQuestions[1]).toMatchObject({
      revealKind: 'closest_guess_pending',
    });
    expect(view.revealQuestions[1]).not.toHaveProperty('answer');
  });

  it('keeps the full data at step 0 in the admin view', () => {
    const view = projectScreen(closestGuessSession(0), SOCKET_ROOMS.ADMIN);

    expect(view.revealQuestions[0]).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
      closestGuess: SUMMARY,
    });
  });

  it('carries the on-air reveal question trimmed to its step on the display reveal screen', () => {
    const { screen } = projectScreen(
      closestGuessSession(0, SUMMARY, { revealIndex: 1 }),
      SOCKET_ROOMS.DISPLAY,
    );

    expect(screen).toMatchObject({
      kind: 'reveal',
      question: { revealKind: 'closest_guess_pending' },
    });
    if (screen.kind !== 'reveal') throw new Error('not a reveal screen');
    expect(screen.question).not.toHaveProperty('answer');
  });

  it('carries the ended walk fully revealed in the players view', () => {
    const state = {
      ...closestGuessSession(0),
      progress: {
        ...closestGuessSession(0).progress,
        status: 'ended' as const,
        previousStatus: 'reveal' as const,
      },
    };

    expect(onAir(state)).toMatchObject({
      revealKind: 'closest_guess',
      answer: '55',
      closestGuess: SUMMARY,
    });
  });
});

describe('Screen projection — players view reveal kind', () => {
  it('sends every non-closest_guess reveal question as the answer kind with no stats', () => {
    const state = session([round(1, 2, true)], {
      roundIndex: 0,
      questionIndex: 1,
      revealIndex: 1,
    });

    const { revealQuestions } = projectScreen(state, SOCKET_ROOMS.PLAYERS);

    expect(revealQuestions).toHaveLength(2);
    for (const revealed of revealQuestions) {
      expect(revealed).toMatchObject({ revealKind: 'answer' });
      expect(revealed).toHaveProperty('answer');
      expect(revealed).not.toHaveProperty('closestGuess');
    }
  });
});
