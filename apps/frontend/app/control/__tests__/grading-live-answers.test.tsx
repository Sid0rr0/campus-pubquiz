import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

describe('AdminPage — grading live answers', () => {
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

  it('shows live answers for the current question with team name and value', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'question_open' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 1 }] }],
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
          points: 1,
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
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(screen.getAllByText('The Quizzards').length).toBeGreaterThan(0);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('shows every team even if it has not answered yet, and the round, question number and correct answer', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'question_open' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 1 }] }],
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: {
        questionId: 1,
        question: {
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
          correctAnswer: 'Banana',
          roundTitle: 'Fruit & Veg',
          roundNumber: 2,
          questionNumberInRound: 3,
          totalQuestionsInRound: 4,
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
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(screen.getByText(/round 2 \(fruit & veg\)/i)).toHaveTextContent(
      'Q3 of 4',
    );
    expect(screen.getByText(/correct answer: banana/i)).toBeInTheDocument();
    expect(screen.getByText('No answer yet')).toBeInTheDocument();

    const unansweredRow = screen.getByText('No answer yet').closest('li');
    expect(unansweredRow).toHaveClass('opacity-40');
    expect(unansweredRow).toHaveTextContent('Beer Necessities');
    expect(
      screen.getByRole('button', {
        name: /grade beer necessities full points/i,
      }),
    ).toBeDisabled();
  });
});
