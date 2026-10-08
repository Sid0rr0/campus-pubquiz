import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import { authenticatedAuthResult, getDesktopButton } from './test-utils';

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

const JOIN_OVERLAY_BUTTON = /^join overlay$/i;

function showAdminAt(
  progress: Record<string, unknown>,
  sendAction = vi.fn(),
): void {
  mockUseAdminGame.mockReturnValue({
    session: { progress },
    connectionError: null,
    sendAction,
  });
  renderWithQuery(<AdminPage />);
}

describe('AdminPage — join overlay button', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('sends TOGGLE_JOIN_OVERLAY when pressed mid-quiz', async () => {
    const sendAction = vi.fn();
    showAdminAt({ status: 'question_open' }, sendAction);

    await userEvent.click(getDesktopButton(JOIN_OVERLAY_BUTTON));

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_JOIN_OVERLAY');
  });

  it('is not pressed while the overlay is hidden', () => {
    showAdminAt({ status: 'question_open', isJoinOverlayVisible: false });

    expect(getDesktopButton(JOIN_OVERLAY_BUTTON)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows a pressed state while the overlay is up', () => {
    showAdminAt({ status: 'question_open', isJoinOverlayVisible: true });

    expect(getDesktopButton(JOIN_OVERLAY_BUTTON)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it.each(['lobby', 'ended'])('is not offered in %s', (status) => {
    showAdminAt({ status });

    expect(
      within(screen.getByRole('complementary')).queryByRole('button', {
        name: JOIN_OVERLAY_BUTTON,
      }),
    ).not.toBeInTheDocument();
  });
});
