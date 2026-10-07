import { vi } from 'vitest';
import {
  describePlayersScreen,
  type GameProgress,
  type OnAirInput,
  type PlayersStatePayload,
} from '@campus-pubquiz/types';

export function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

type PlayersFixture = OnAirInput & { isCurrentRoundKahoot?: boolean };

/**
 * Builds the view a phone is sent from a partial fixture: the fixture is the
 * core snapshot, and the fields the server adds to the players view are
 * filled in — the screen fields from the same shared rule the backend
 * projection uses, answerability from a default that mirrors the server's
 * rule (which is tested against the real gate in the backend). Fields the
 * fixture sets itself win.
 */
export function playersView<T extends PlayersFixture>(
  snapshot: T,
): T & Pick<PlayersStatePayload, 'isAnswerable' | 'feedback'> {
  const { status, isLeaderboardVisible } = snapshot.progress;
  const isHiddenKahoot =
    (snapshot.isCurrentRoundKahoot ?? false) && isLeaderboardVisible;
  const hasOpenQuestions =
    status === 'round_intro'
      ? (snapshot.blockQuestions ?? []).length > 0
      : true;
  const isAnswerable =
    !isHiddenKahoot &&
    (status === 'question_open' ||
      status === 'locking' ||
      status === 'round_intro') &&
    hasOpenQuestions;
  return {
    ...describePlayersScreen({
      ...snapshot,
      isAnswerable,
      isShowdownResolved: false,
    }),
    isAnswerable,
    feedback: null,
    ...snapshot,
  };
}

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';

/**
 * The result of the Team link adapter (`useTeamLink`) for a page test. A phone
 * counts as joined when the test saved a team name in localStorage (the
 * `joinAsTeam` helpers) — the stand-in for the identity the real adapter
 * restores — so those fields are read when the page asks for them.
 */
export function socketResult(overrides: Record<string, unknown> = {}) {
  const { snapshot } = overrides;
  const result = {
    snapshot: null,
    connectionError: null,
    team: null,
    submitAnswer: vi.fn(),
    submitShowdownGuess: vi.fn(),
    myAnswers: {},
    myAnswerGrades: {},
    myBonusAwards: [],
    myRoundRatings: {},
    myFeedback: { comment: '', topics: [] },
    sendFeedback: vi.fn().mockResolvedValue({ success: true }),
    roundRatingsEpoch: 0,
    rateRound: vi.fn().mockResolvedValue({ success: true }),
    seenQuestions: {},
    nameInput: '',
    setNameInput: vi.fn(),
    codeInput: '',
    setCodeInput: vi.fn(),
    teamCodeInput: '',
    setTeamCodeInput: vi.fn(),
    handleJoin: vi.fn(),
    handleLogOut: vi.fn(),
    ...overrides,
    ...(snapshot ? { snapshot: playersView(snapshot as PlayersFixture) } : {}),
  };
  const storedName = () => window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
  return Object.defineProperties(result, {
    teamName: lazy(overrides, 'teamName', storedName),
    hasStoredIdentity: lazy(overrides, 'hasStoredIdentity', () =>
      Boolean(storedName()),
    ),
    activeJoinCode: lazy(overrides, 'activeJoinCode', () =>
      storedName() ? 'ABCDEF' : null,
    ),
  });
}

/** A property an override sets wins; otherwise it is read on access. */
function lazy<T>(
  overrides: Record<string, unknown>,
  key: string,
  read: () => T,
): PropertyDescriptor {
  return {
    enumerable: true,
    get: () => (key in overrides ? overrides[key] : read()),
  };
}
