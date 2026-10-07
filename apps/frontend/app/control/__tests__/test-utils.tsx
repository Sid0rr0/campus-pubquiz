import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { SOCKET_ROOMS, type AuthUser } from '@campus-pubquiz/types';
import { roomView, type SessionDescription } from '@/test-utils/room-view';
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
 * A complete admin-hook result for page tests: each test passes only what it
 * exercises, and every other member is a spy that resolves to success — so a
 * page can't crash on a member the test didn't think about.
 */
export function adminGameResult(
  overrides: Partial<UseAdminGameResult> & {
    /** Describe the session; the snapshot is the view the admin room is sent for it. */
    session?: SessionDescription;
  } = {},
): UseAdminGameResult {
  const { session, ...hookOverrides } = overrides;
  const ok = () => Promise.resolve({ success: true as const });
  return {
    snapshot: session ? roomView(SOCKET_ROOMS.ADMIN, session) : null,
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
    ...hookOverrides,
  };
}
