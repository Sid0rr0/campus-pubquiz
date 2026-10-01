import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  DEFAULT_DISPLAY_TEXT_SCALE,
  describeAdminIndicators,
  describeOnAirScreen,
  type AdminIndicators,
  type OnAirInput,
  type AdminStatePayload,
  type AuthUser,
  type GameProgress,
  type GameStatus,
} from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import type { UseAdminGameResult } from '@/app/lib/use-admin-game';

export const TEST_ADMIN_USER: AuthUser = {
  id: 1,
  username: 'test-admin',
  role: 'admin',
  status: 'active',
};

export function authenticatedAuthResult(
  overrides: Partial<UseAuthResult> = {},
): UseAuthResult {
  return {
    user: TEST_ADMIN_USER,
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

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

// Advance/Previous render in both the always-mounted mobile sticky bar and
// the desktop sidebar (each hidden from the other via a CSS media query that
// jsdom doesn't evaluate) — scope to the desktop <aside> (the "complementary"
// landmark) so these queries match exactly one button.
export function getDesktopButton(name: RegExp): HTMLElement {
  return within(screen.getByRole('complementary')).getByRole('button', {
    name,
  });
}

const STATUSES_WITH_ADVANCE = new Set<GameStatus>([
  'rules',
  'round_overview',
  'round_intro',
  'question_open',
  'locking',
  'break_intro',
  'break',
  'break_round_intro',
  'reveal_intro',
  'reveal',
]);
const STATUSES_WITH_PREVIOUS = new Set<GameStatus>([
  'round_overview',
  'round_intro',
  'question_open',
  'locking',
  'break_intro',
  'break',
  'reveal_intro',
  'reveal',
]);

/**
 * Fixture default for the flags the server decides: whether Advance/Previous
 * are accepted. The real rules live in (and are tested against) the backend's
 * projection; a test that needs a different answer sets the flag itself.
 */
function defaultActionAvailability(snapshot: {
  progress: GameProgress;
  activeShowdown?: OnAirInput['activeShowdown'];
  showdownRevealStep?: number;
}): Pick<
  AdminStatePayload,
  'canAdvance' | 'canGoToPreviousQuestion' | 'advanceStep' | 'previousState'
> {
  const { status, previousStatus, isLeaderboardVisible } = snapshot.progress;
  const hasShowdown = snapshot.activeShowdown != null;
  const canAdvance =
    STATUSES_WITH_ADVANCE.has(status) || (status === 'ended' && hasShowdown);
  const canGoToPreviousQuestion =
    STATUSES_WITH_PREVIOUS.has(status) ||
    (status === 'ended' && previousStatus != null) ||
    (status === 'ended' &&
      hasShowdown &&
      (snapshot.showdownRevealStep ?? 0) > 0);
  let previousState: AdminStatePayload['previousState'] = 'unavailable';
  if (canGoToPreviousQuestion) {
    previousState = isLeaderboardVisible
      ? 'covered_by_leaderboard'
      : 'available';
  }
  return {
    canAdvance,
    canGoToPreviousQuestion,
    // Under the leaderboard the step depends on the reveal count, which only
    // the server knows — a test that needs a reveal or hide step sets it.
    advanceStep: canAdvance ? 'advance' : 'none',
    previousState,
  };
}

/**
 * Builds the view /control is sent from a partial fixture: the fixture is the
 * core snapshot, and the fields the server adds to the admin view are filled
 * in — the on-air fields from the same shared rule the backend projection
 * uses, the Advance step and Previous state from a per-status default, and the
 * always-present snapshot fields a test didn't bother to set from empty defaults. Fields the
 * fixture sets itself win.
 */
export function adminView<
  T extends {
    progress: GameProgress;
    activeShowdown?: OnAirInput['activeShowdown'];
    showdownRevealStep?: number;
  },
>(
  snapshot: T,
): T &
  Pick<AdminStatePayload, 'onAirScreen'> &
  AdminIndicators &
  Pick<
    AdminStatePayload,
    'canAdvance' | 'canGoToPreviousQuestion' | 'advanceStep' | 'previousState'
  > &
  Pick<AdminStatePayload, 'isShowdownEligible' | 'isLastQuestionBeforeBreak'> {
  return {
    onAirScreen: describeOnAirScreen(snapshot).screen,
    ...describeAdminIndicators(snapshot),
    ...defaultActionAvailability(snapshot),
    isShowdownEligible: false,
    isLastQuestionBeforeBreak: false,
    teams: [],
    answeredTeamIds: [],
    breakEndsAt: null,
    displayTextScale: DEFAULT_DISPLAY_TEXT_SCALE,
    activeShowdown: null,
    leaderboardRevealCount: 0,
    ...snapshot,
  };
}

/**
 * A complete admin-hook result for page tests: each test passes only what it
 * exercises, and every other member is a spy that resolves to success — so a
 * page can't crash on a member the test didn't think about.
 */
export function adminGameResult(
  overrides: Partial<UseAdminGameResult> = {},
): UseAdminGameResult {
  const ok = () => Promise.resolve({ success: true as const });
  return {
    snapshot: null,
    connectionError: null,
    reconnectedAt: null,
    liveAnswers: null,
    setLiveAnswers: vi.fn(),
    focusAnswersQuestionId: vi.fn(),
    presenterContext: null,
    sendAction: vi.fn(ok),
    gradeAnswer: vi.fn(ok),
    kickTeam: vi.fn(ok),
    awardBonus: vi.fn(ok),
    setBreakEndTime: vi.fn(ok),
    setDisplayTextScale: vi.fn(ok),
    createShowdownRound: vi.fn(ok),
    ...overrides,
  };
}
