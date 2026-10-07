import { screen } from '@testing-library/react';
import type { SessionDescription } from '@/test-utils/room-view';
import type { GameProgress } from '@campus-pubquiz/types';
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

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AdminPage — server-decided break and showdown controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    // An empty quiz list: nothing the page could derive the flags from.
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  function renderWith(
    progress: Partial<GameProgress>,
    description: Pick<SessionDescription, 'ungradedQuestionIds'> = {},
  ) {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress,
        leaderboard: [
          { teamId: 1, teamName: 'Team A', rank: 1, totalPoints: 5 },
          { teamId: 2, teamName: 'Team B', rank: 1, totalPoints: 5 },
        ],
        ...description,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);
  }

  it('offers the break end time before the break when the admin view says it is the last question before break', () => {
    // The default round has two questions and a break after it.
    renderWith({ status: 'question_open', questionIndex: 1 });

    expect(screen.getAllByLabelText(/break/i).length).toBeGreaterThan(0);
  });

  it('hides the break end time mid-block when the admin view says so', () => {
    renderWith({ status: 'question_open', questionIndex: 0 });

    expect(screen.queryByLabelText(/break/i)).not.toBeInTheDocument();
  });

  it('offers the showdown when the admin view marks it eligible and teams are tied', () => {
    renderWith({ status: 'break' });

    expect(screen.getAllByText(/tied for 1st/i).length).toBeGreaterThan(0);
  });

  it('hides the showdown when the admin view does not mark it eligible', () => {
    // A question in the final round is still ungraded.
    renderWith({ status: 'break' }, { ungradedQuestionIds: [1] });

    expect(screen.queryByText(/tied for 1st/i)).not.toBeInTheDocument();
  });
});
