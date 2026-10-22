import {
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameProgress,
  type GameStatus,
  type LeaderboardEntry,
  projectScreen,
  type SeededQuestion,
  type SessionState,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';
import { SEEDED_GAME_SUMMARY_DEFAULTS } from '@/game/__tests__/seeded-game-defaults';

const YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ';
const VIDEO_FILE = 'https://example.com/clip.mp4';
const AUDIO = 'https://example.com/song.mp3';
const IMAGE = 'https://example.com/picture.png';

function question(
  id: number,
  media: { mediaUrl?: string; answerMediaUrl?: string } = {},
  type: 'free_text' | 'closest_guess' = 'free_text',
): SeededQuestion {
  return {
    id,
    type,
    prompt: `Question ${id}`,
    options: [],
    points: 1,
    answer: type === 'closest_guess' ? '10' : 'A',
    ...media,
  } as unknown as SeededQuestion;
}

function session(
  questions: SeededQuestion[],
  progress: Partial<GameProgress>,
  extra: Partial<SessionState> = {},
): SessionState {
  const base: GameProgress = {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    isJoinOverlayVisible: false,
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
        ...SEEDED_GAME_SUMMARY_DEFAULTS,
        rounds: [{ id: 1, title: 'Round 1', breakAfter: true, questions }],
        settings: DEFAULT_SESSION_SETTINGS,
      },
      base,
    ),
    ...extra,
  };
}

function controls(state: SessionState) {
  return projectScreen(state, SOCKET_ROOMS.ADMIN).controlAvailability;
}

function media(state: SessionState) {
  const { canReplayMedia, canPauseMedia } = controls(state);
  return { canReplayMedia, canPauseMedia };
}

const NO_MEDIA = { canReplayMedia: false, canPauseMedia: false };
const VIDEO = { canReplayMedia: true, canPauseMedia: true };
const AUDIO_ONLY = { canReplayMedia: false, canPauseMedia: true };

describe('Screen projection — control availability: status-based fields', () => {
  const q = [question(1)];

  it('offers Start and no End in the lobby', () => {
    expect(controls(session(q, { status: 'lobby' }))).toMatchObject({
      canStartQuiz: true,
      canEndQuiz: true,
      canCloseSession: false,
      canToggleJoinOverlay: false,
    });
  });

  it('offers End and no Start or Close in a running status', () => {
    expect(controls(session(q, { status: 'question_open' }))).toMatchObject({
      canStartQuiz: false,
      canEndQuiz: true,
      canCloseSession: false,
      canToggleJoinOverlay: true,
    });
  });

  it('offers Close and no End once the quiz has ended', () => {
    expect(controls(session(q, { status: 'ended' }))).toMatchObject({
      canStartQuiz: false,
      canEndQuiz: false,
      canCloseSession: true,
      canToggleJoinOverlay: false,
    });
  });

  it.each([
    'rules',
    'round_intro',
    'question_open',
    'break',
    'reveal',
  ] as const)('allows the join overlay in %s', (status) => {
    expect(controls(session(q, { status })).canToggleJoinOverlay).toBe(true);
  });

  it.each(['lobby', 'ended'] as const)(
    'does not allow the join overlay in %s',
    (status) => {
      expect(controls(session(q, { status })).canToggleJoinOverlay).toBe(false);
    },
  );

  it.each([
    ['question_open', true],
    ['locking', true],
    ['break', false],
    ['reveal', false],
    ['lobby', false],
  ] as [GameStatus, boolean][])(
    'shows answer status in %s: %s',
    (status, expected) => {
      expect(controls(session(q, { status })).showAnswerStatus).toBe(expected);
    },
  );
});

describe('Screen projection — control availability: open question media', () => {
  it.each([
    ['YouTube', YOUTUBE, VIDEO],
    ['an uploaded video', VIDEO_FILE, VIDEO],
    ['audio', AUDIO, AUDIO_ONLY],
    ['an image', IMAGE, NO_MEDIA],
    ['no media', undefined, NO_MEDIA],
  ])('with %s', (_label, mediaUrl, expected) => {
    expect(media(session([question(1, { mediaUrl })], {}))).toEqual(expected);
  });
});

describe('Screen projection — control availability: reveal media', () => {
  const reveal = { status: 'reveal' as const };

  it("follows the answer media, which replaces the question's own", () => {
    const state = session(
      [question(1, { mediaUrl: IMAGE, answerMediaUrl: VIDEO_FILE })],
      reveal,
    );
    expect(media(state)).toEqual(VIDEO);
  });

  it('does not offer controls for the question video once the answer media is an image', () => {
    const state = session(
      [question(1, { mediaUrl: YOUTUBE, answerMediaUrl: IMAGE })],
      reveal,
    );
    expect(media(state)).toEqual(NO_MEDIA);
  });

  it("follows the question's own media without answer media", () => {
    const state = session([question(1, { mediaUrl: AUDIO })], reveal);
    expect(media(state)).toEqual(AUDIO_ONLY);
  });

  it('offers nothing when the media is an image', () => {
    const state = session([question(1, { mediaUrl: IMAGE })], reveal);
    expect(media(state)).toEqual(NO_MEDIA);
  });
});

describe('Screen projection — control availability: closest_guess reveal', () => {
  const guessed = {
    hasSubmissions: true,
    minGuess: '5',
    maxGuess: '20',
    closestGuesses: [{ teamName: 'Team A', value: '9' }],
  };

  function closestGuessReveal(revealStep: number) {
    return session(
      [question(1, { answerMediaUrl: VIDEO_FILE }, 'closest_guess')],
      { status: 'reveal' },
      { revealStep, closestGuessSummaries: { 1: guessed } },
    );
  }

  it.each([0, 1, 2])(
    'offers nothing at step %s, before the walk reaches the answer media',
    (step) => {
      expect(media(closestGuessReveal(step))).toEqual(NO_MEDIA);
    },
  );

  it.each([3, 4])('offers the answer video at step %s', (step) => {
    expect(media(closestGuessReveal(step))).toEqual(VIDEO);
  });
});

describe('Screen projection — control availability: screens that play nothing', () => {
  const q = [question(1, { mediaUrl: YOUTUBE })];

  it('offers nothing while the question is locking', () => {
    const state = session(q, { status: 'locking' }, { questionLockAt: 1 });
    expect(media(state)).toEqual(NO_MEDIA);
  });

  it('offers nothing in break review', () => {
    expect(media(session(q, { status: 'break' }))).toEqual(NO_MEDIA);
  });

  it('offers nothing on a title card', () => {
    expect(media(session(q, { status: 'round_intro' }))).toEqual(NO_MEDIA);
  });

  it('offers nothing under the leaderboard', () => {
    const state = session(q, { isLeaderboardVisible: true });
    expect(media(state)).toEqual(NO_MEDIA);
  });

  it('offers nothing under the join overlay', () => {
    const state = session(q, { isJoinOverlayVisible: true });
    expect(media(state)).toEqual(NO_MEDIA);
  });
});

describe('Screen projection — control availability: tied for first', () => {
  function entry(
    teamId: number,
    teamName: string,
    totalPoints: number,
    rank: number,
  ): LeaderboardEntry {
    return { teamId, teamName, totalPoints, rank } as LeaderboardEntry;
  }

  it('names the teams tied for first', () => {
    const state = session(
      [question(1)],
      { status: 'ended' },
      {
        leaderboard: [
          entry(1, 'Alpha', 5, 1),
          entry(2, 'Beta', 5, 1),
          entry(3, 'Gamma', 2, 3),
        ],
      },
    );
    expect(controls(state).tiedTeamNames).toEqual(['Alpha', 'Beta']);
  });

  it('names nobody with an outright leader', () => {
    const state = session(
      [question(1)],
      { status: 'ended' },
      { leaderboard: [entry(1, 'Alpha', 6, 1), entry(2, 'Beta', 5, 2)] },
    );
    expect(controls(state).tiedTeamNames).toEqual([]);
  });
});

describe('Screen projection — control availability is admin-only', () => {
  it.each([SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.PLAYERS])(
    'omits it from the %s view',
    (room) => {
      const view = projectScreen(session([question(1)], {}), room);
      expect(view).not.toHaveProperty('controlAvailability');
    },
  );

  it('does not send the Display screen to the admin room', () => {
    const view = projectScreen(session([question(1)], {}), SOCKET_ROOMS.ADMIN);
    expect(view).not.toHaveProperty('screen');
  });
});
