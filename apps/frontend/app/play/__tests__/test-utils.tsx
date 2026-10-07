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

const CONNECTION = { socketId: 'socket-1' };

export function socketResult(overrides: Record<string, unknown> = {}) {
  const { snapshot } = overrides;
  return {
    snapshot: null,
    connectionError: null,
    sendAction: vi.fn(),
    team: null,
    sendJoin: vi.fn().mockResolvedValue({ success: true }),
    submitAnswer: vi.fn(),
    liveAnswers: null,
    gradeAnswer: vi.fn(),
    leaveSession: vi.fn(),
    myAnswers: {},
    myAnswerGrades: {},
    myBonusAwards: [],
    myRoundRatings: {},
    myFeedback: { comment: '', topics: [] },
    sendFeedback: vi.fn().mockResolvedValue({ success: true }),
    roundRatingsEpoch: 0,
    rateRound: vi.fn().mockResolvedValue({ success: true }),
    seenQuestions: {},
    // A fixed "already connected" marker: the Team link only sends a join
    // once the connection is known. The same object on every render, like
    // the real hook's between connects.
    socketConnection: CONNECTION,
    ...overrides,
    ...(snapshot ? { snapshot: playersView(snapshot as PlayersFixture) } : {}),
  };
}
