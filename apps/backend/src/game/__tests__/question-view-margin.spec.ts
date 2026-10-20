import {
  DEFAULT_MARGIN,
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameProgress,
  type Margin,
  projectScreen,
  rowToSeededQuestion,
  type SeededQuestion,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';

const STORED_MARGIN: Margin = { value: 5, unit: 'absolute' };

function question(
  id: number,
  type: SeededQuestion['type'],
  margin?: Margin,
): SeededQuestion {
  // Seeded through the codec, as a session is: a margin stored on a type
  // that has none never reaches the seeded question.
  return rowToSeededQuestion(
    { id, type, prompt: `Question ${id}`, points: 1, answer: '100' },
    margin ? { margin } : {},
  );
}

// Number with a stored margin, an older Number with none, and two types that
// carry no margin even when one was left on the stored question.
const QUESTIONS = [
  question(1, 'number', STORED_MARGIN),
  question(2, 'number'),
  question(3, 'closest_guess', STORED_MARGIN),
  question(4, 'free_text', STORED_MARGIN),
];

function session(progress: Partial<GameProgress>): SessionState {
  return freshSessionState(
    {
      quizId: 1,
      gameSessionId: 1,
      joinCode: 'ABCDEF',
      rounds: [
        { id: 1, title: 'Round', breakAfter: true, questions: QUESTIONS },
      ],
      settings: DEFAULT_SESSION_SETTINGS,
    },
    {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      isJoinOverlayVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 3,
      ...progress,
    },
  );
}

const EXPECTED_MARGINS = [STORED_MARGIN, DEFAULT_MARGIN, undefined, undefined];

describe('Screen projection — a question view carries a margin only for types that have one', () => {
  it('sends the open block questions with the resolved margin', () => {
    const view = projectScreen(session({}), SOCKET_ROOMS.PLAYERS);

    expect(view.blockQuestions.map((q) => q.margin)).toEqual(EXPECTED_MARGINS);
    expect(view.blockQuestions[2]).not.toHaveProperty('margin');
    expect(view.blockQuestions[3]).not.toHaveProperty('margin');
  });

  it('sends the on-air question with the default margin when none is stored', () => {
    const { screen } = projectScreen(
      session({ questionIndex: 1 }),
      SOCKET_ROOMS.DISPLAY,
    );

    expect(screen).toMatchObject({
      kind: 'question',
      question: { margin: DEFAULT_MARGIN },
    });
  });

  it('sends the reveal view with the resolved margin', () => {
    const view = projectScreen(
      session({ status: 'reveal', questionIndex: 3 }),
      SOCKET_ROOMS.ADMIN,
    );

    expect(view.revealQuestions.map((q) => q.margin)).toEqual(EXPECTED_MARGINS);
    expect(view.revealQuestions[2]).not.toHaveProperty('margin');
    expect(view.revealQuestions[3]).not.toHaveProperty('margin');
  });
});
