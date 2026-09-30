import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  describeAdminIndicators,
  describeOnAirScreen,
  type AdminIndicators,
  type AdminStatePayload,
  type AuthUser,
  type GameProgress,
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

/**
 * Builds the view /control is sent from a partial fixture: the fixture is the
 * core snapshot, and the on-air fields the server adds to the admin view are
 * derived from it with the same shared rule the backend projection uses.
 */
export function adminView<T extends { progress: GameProgress }>(
  snapshot: T,
): T & Pick<AdminStatePayload, 'onAirScreen'> & AdminIndicators {
  return {
    ...snapshot,
    onAirScreen: describeOnAirScreen(snapshot).screen,
    ...describeAdminIndicators(snapshot),
  };
}
