import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import { authenticatedAuthResult } from './test-utils';

const {
  mockUseAdminGame,
  mockFetchQuizzes,
  mockFetchAnswers,
  mockUseAuth,
  searchParamsRef,
} = vi.hoisted(() => ({
  mockUseAdminGame: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockFetchAnswers: vi.fn(),
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

vi.mock('@/app/lib/answer-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/answer-api')>();
  return { ...actual, fetchAnswers: mockFetchAnswers };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AdminPage — grading quick point buttons', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockFetchAnswers.mockReset();
    mockFetchAnswers.mockResolvedValue(null);
  });

  it('grades an ungraded answer with the full-points quick button', async () => {
    const gradeAnswer = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 2 }] }],
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: {
        questionId: 1,
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      },
      gradeAnswer,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /grade the quizzards full points/i }),
    );

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 2);
  });

  it('grades an ungraded answer with the half-points quick button', async () => {
    const gradeAnswer = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 2 }] }],
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: {
        questionId: 1,
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      },
      gradeAnswer,
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /grade the quizzards half points/i }),
    );

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 1);
  });

  it('shows the awarded grade as a checked quick button that stays enabled for an already-graded answer', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 2 }] }],
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: {
        questionId: 1,
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    const fullPointsButton = screen.getByRole('button', {
      name: /grade the quizzards full points/i,
    });
    expect(fullPointsButton).toHaveTextContent('✓ Full (2)');
    expect(fullPointsButton).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /grade the quizzards 0 points/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /grade the quizzards half points/i }),
    ).toBeEnabled();
  });

  it('lets the admin change an already-graded answer to a different point value', async () => {
    const user = userEvent.setup();
    const gradeAnswer = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 2 }] }],
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: {
        questionId: 1,
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 2,
          correctAnswer: 'Banana',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 'answer-1',
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      gradeAnswer,
    });
    renderWithQuery(<AdminPage />);

    await user.click(
      screen.getByRole('button', { name: /grade the quizzards 0 points/i }),
    );

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 0);
  });
});
