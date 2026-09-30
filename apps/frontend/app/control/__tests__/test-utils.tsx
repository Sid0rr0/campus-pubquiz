import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
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
}): Pick<AdminStatePayload, 'canAdvance' | 'canGoToPreviousQuestion'> {
  const { status, previousStatus } = snapshot.progress;
  const hasShowdown = snapshot.activeShowdown != null;
  return {
    canAdvance:
      STATUSES_WITH_ADVANCE.has(status) || (status === 'ended' && hasShowdown),
    canGoToPreviousQuestion:
      STATUSES_WITH_PREVIOUS.has(status) ||
      (status === 'ended' && previousStatus != null) ||
      (status === 'ended' &&
        hasShowdown &&
        (snapshot.showdownRevealStep ?? 0) > 0),
  };
}

/**
 * Builds the view /control is sent from a partial fixture: the fixture is the
 * core snapshot, and the fields the server adds to the admin view are filled
 * in — the on-air fields from the same shared rule the backend projection
 * uses, the button availability from a per-status default. Fields the
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
  Pick<AdminStatePayload, 'canAdvance' | 'canGoToPreviousQuestion'> {
  return {
    onAirScreen: describeOnAirScreen(snapshot).screen,
    ...describeAdminIndicators(snapshot),
    ...defaultActionAvailability(snapshot),
    ...snapshot,
  };
}
