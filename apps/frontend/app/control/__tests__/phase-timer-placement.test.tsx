import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import { authenticatedAuthResult } from './test-utils';

const { mockUseAdminGame, mockFetchQuizzes, mockUseAuth } = vi.hoisted(() => ({
  mockUseAdminGame: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockUseAuth: vi.fn(),
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

vi.mock('@/app/lib/answer-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/answer-api')>();
  return { ...actual, fetchAnswers: vi.fn().mockResolvedValue(null) };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('code=TESTCODE'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AdminPage — phase timer placement', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'question_open', questionIndex: 0 },
        phaseTimer: { elapsedMs: 65_000 },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 1 }] }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
  });

  it('shows the timer in the sidebar header and in the mobile bar, not in the main area', () => {
    const { container } = renderWithQuery(<AdminPage />);

    const sidebar = container.querySelector('aside') as HTMLElement;
    expect(
      within(
        within(sidebar).getByRole('heading', { name: 'Quiz Master' })
          .parentElement as HTMLElement,
      ).getByTestId('phase-timer'),
    ).toHaveTextContent('1:05');

    // The mobile bar is the sibling before the sidebar.
    const mobileBar = sidebar.previousElementSibling as HTMLElement;
    expect(within(mobileBar).getByTestId('phase-timer')).toHaveTextContent(
      '1:05',
    );

    expect(screen.getAllByTestId('phase-timer')).toHaveLength(2);
  });
});
