import {
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
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

const ROUNDS: SeededRound[] = [
  { id: 1, title: 'Alpha', breakAfter: true, questions: [question(10)] },
  { id: 2, title: 'Beta', breakAfter: true, questions: [question(20)] },
];

function session(): SessionState {
  return {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        rounds: ROUNDS,
        settings: DEFAULT_SESSION_SETTINGS,
      },
      {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
        isJoinOverlayVisible: false,
        revealIndex: 0,
        furthestOpenIndex: 0,
      },
    ),
    displayTextScale: 1.25,
    isDisplaySoundMuted: true,
    breakEndsAt: 123,
    answeredTeamIdsByQuestion: { 10: [1] },
  };
}

describe('room view fields', () => {
  it('sends the players view none of the fields only the big screen and /control read', () => {
    const view = projectScreen(session(), SOCKET_ROOMS.PLAYERS);

    expect(view).not.toHaveProperty('displayTextScale');
    expect(view).not.toHaveProperty('isDisplaySoundMuted');
    expect(view).not.toHaveProperty('breakEndsAt');
    expect(view).not.toHaveProperty('answeredTeamIds');
    expect(view).not.toHaveProperty('roundTitles');
  });

  it.each([SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.ADMIN] as const)(
    'sends the %s view the fields the big screen and /control read',
    (room) => {
      const view = projectScreen(session(), room);

      expect(view.displayTextScale).toBe(1.25);
      expect(view.isDisplaySoundMuted).toBe(true);
      expect(view.roundTitles).toEqual(['Alpha', 'Beta']);
      expect(view.answeredTeamIds).toEqual([]);
    },
  );

  it('sends the admin view the break end time', () => {
    expect(projectScreen(session(), SOCKET_ROOMS.ADMIN).breakEndsAt).toBe(123);
  });

  it('keeps the break end time off the top of the display view (it rides its break screen)', () => {
    const view = projectScreen(session(), SOCKET_ROOMS.DISPLAY);

    expect(view).not.toHaveProperty('breakEndsAt');
  });

  it.each([SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.ADMIN, SOCKET_ROOMS.PLAYERS])(
    'sends no closest-guess reveal step to the %s view',
    (room) => {
      expect(projectScreen(session(), room)).not.toHaveProperty(
        'closestGuessRevealStep',
      );
    },
  );

  it('still changes the reveal screen key with the closest-guess step', () => {
    const guessed = {
      ...session(),
      seededGame: {
        ...session().seededGame,
        rounds: [
          {
            ...ROUNDS[0],
            questions: [
              { ...question(10), type: 'closest_guess', answer: '55' },
            ],
          },
          ROUNDS[1],
        ] as unknown as SeededRound[],
      },
      closestGuessSummaries: {
        10: {
          hasSubmissions: true,
          minGuess: '10',
          maxGuess: '90',
          closestGuesses: [],
        },
      },
    };
    const at = (step: number) =>
      projectScreen(
        { ...guessed, closestGuessRevealStep: step },
        SOCKET_ROOMS.DISPLAY,
      ).screenKey;

    expect(at(1)).not.toBe(at(0));
  });
});
