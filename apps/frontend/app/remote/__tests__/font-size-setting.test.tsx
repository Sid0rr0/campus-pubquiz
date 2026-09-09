import { fireEvent, screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import RemotePage from '@/app/remote/page';

const { mockUseGameSocket, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseGameSocket: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams('code=ABCDEF') },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

function authenticatedAuthResult(
  overrides: Partial<UseAuthResult> = {},
): UseAuthResult {
  return {
    user: { id: 1, username: 'test-admin', role: 'admin', status: 'active' },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    progress: progress(),
    joinCode: 'ABCDEF',
    quizStructure: { breakRoundNumbers: [] },
    leaderboard: [],
    leaderboardRevealCount: 0,
    activeShowdown: null,
    showdownRevealStep: 0,
    ...overrides,
  };
}

describe('RemotePage — display text scale control (reused from /control)', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
  });

  it('shows the current /display text scale from the snapshot', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot({ displayTextScale: 1.25 }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      setDisplayTextScale: vi.fn(),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('125%')).toBeInTheDocument();
  });

  it('steps the shared /display text scale up via setDisplayTextScale', () => {
    const setDisplayTextScale = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot({ displayTextScale: 1 }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      setDisplayTextScale,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(
      screen.getByRole('button', { name: /increase display text size/i }),
    );

    expect(setDisplayTextScale).toHaveBeenCalledWith(1.25);
  });

  it('steps the shared /display text scale down via setDisplayTextScale', () => {
    const setDisplayTextScale = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot({ displayTextScale: 1 }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      setDisplayTextScale,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(
      screen.getByRole('button', { name: /decrease display text size/i }),
    );

    expect(setDisplayTextScale).toHaveBeenCalledWith(0.75);
  });
});
