import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import { authenticatedAuthResult } from './test-utils';

const { mockUseAdminGame, mockFetchQuizzes, mockUseAuth, searchParamsRef } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockFetchQuizzes: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams('code=TESTCODE') },
  }));

vi.mock('@/app/lib/use-admin-game', async () => {
  const { adminGameResult } =
    await import('@/app/control/__tests__/test-utils');
  return {
    useAdminGame: (...args: unknown[]) =>
      adminGameResult(mockUseAdminGame(...args)),
  };
});

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

vi.mock('@/app/lib/answer-api', async () =>
  (await import('@/test-utils/answer-api-offline')).createOfflineAnswerApi(),
);

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('@/app/lib/leagues-api', () => ({
  fetchLeagues: () => Promise.resolve({ items: [] }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const SIDES = [
  { id: 'eng', name: 'Engineering' },
  { id: 'law', name: 'Law' },
];

describe('AdminPage — the side bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  function render(versusEnabled: boolean) {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        leaderboard: [
          { teamId: 1, teamName: 'Alpha', totalPoints: 30 },
          { teamId: 2, teamName: 'Beta', totalPoints: 10 },
        ],
        settings: { versusEnabled, versusSides: SIDES },
        teamSides: { 1: 'eng', 2: 'law' },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);
  }

  it('renders the side standings near the teams table', () => {
    render(true);

    const bar = screen.getByTestId('side-bar');
    expect(within(bar).getByText('30 pts avg · 75%')).toBeInTheDocument();
    expect(within(bar).getByText('10 pts avg · 25%')).toBeInTheDocument();
  });

  it('shows no bar without Versus', () => {
    render(false);

    expect(screen.queryByTestId('side-bar')).not.toBeInTheDocument();
  });
});
