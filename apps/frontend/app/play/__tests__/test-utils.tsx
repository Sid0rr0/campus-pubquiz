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
    ...describePlayersScreen({ ...snapshot, isAnswerable }),
    isAnswerable,
    feedback: null,
    ...snapshot,
  };
}

export function socketResult(overrides: Record<string, unknown> = {}) {
  const { snapshot } = overrides;
  return {
    snapshot: null,
    connectionError: null,
    sendAction: vi.fn(),
    team: null,
    joinTeam: vi.fn().mockResolvedValue({ success: true }),
    submitAnswer: vi.fn(),
    liveAnswers: null,
    gradeAnswer: vi.fn(),
    leaveSession: vi.fn(),
    myAnswers: {},
    myAnswerGrades: {},
    myBonusAwards: [],
    myRoundRatings: {},
    roundRatingsEpoch: 0,
    rateRound: vi.fn().mockResolvedValue({ success: true }),
    seenQuestions: {},
    // A fixed "already connected" marker — useTeamJoin's join effect only
    // sends once this is non-null (it mirrors usePlayerGame's real
    // post-connect timestamp), so tests that don't care about reconnect
    // timing need a stand-in value here to still see an immediate joinTeam
    // call. Tests exercising an actual second connection (retry, reconnect)
    // should override this with a distinct value of their own.
    reconnectedAt: 1,
    ...overrides,
    ...(snapshot ? { snapshot: playersView(snapshot as PlayersFixture) } : {}),
  };
}
