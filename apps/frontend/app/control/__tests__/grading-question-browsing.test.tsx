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

describe('AdminPage — grading question browsing', () => {
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

  it('requests and shows the first block question answers during the grading break', async () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break', questionIndex: 1 },
        rounds: [
          {
            questions: [
              { prompt: 'Name a fruit', points: 1 },
              { prompt: 'Name a planet', points: 1 },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await vi.waitFor(() =>
      expect(mockFetchAnswers).toHaveBeenCalledWith('TESTCODE', 1),
    );
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('keeps showing the last question answers for grading once the quiz has ended', async () => {
    mockFetchAnswers.mockResolvedValue({
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
          gradingState: 'ungraded',
          powerUps: [],
        },
      ],
    });
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'ended', isLeaderboardVisible: true },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 2 }] }],
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(await screen.findByText('Banana')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /grade the quizzards full points/i }),
    ).toBeInTheDocument();
  });

  it('browses to another question via the round number picker', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [
                { id: 1, prompt: 'Name a fruit', answer: 'Banana' },
                { id: 2, prompt: 'Name a planet', answer: 'Mars' },
              ],
            },
          ],
        },
      ],
    });
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break', questionIndex: 1 },
        rounds: [
          {
            questions: [
              { prompt: 'Name a fruit', points: 1 },
              { prompt: 'Name a planet', points: 1 },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: /grade question 2 of round 1/i,
      }),
    );

    await vi.waitFor(() =>
      expect(mockFetchAnswers).toHaveBeenCalledWith('TESTCODE', 2),
    );
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });

  it('shows only the picked question’s answers after browsing to another', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [
                { id: 1, prompt: 'Name a fruit', answer: 'Banana' },
                { id: 2, prompt: 'Name a planet', answer: 'Mars' },
              ],
            },
          ],
        },
      ],
    });
    mockFetchAnswers.mockImplementation((_code: string, id: number) =>
      Promise.resolve({
        questionId: id,
        question: {
          type: 'free_text',
          prompt: id === 1 ? 'Name a fruit' : 'Name a planet',
          points: 1,
          correctAnswer: id === 1 ? 'Banana' : 'Mars',
          roundTitle: 'Round 1',
          roundNumber: 1,
          questionNumberInRound: id,
          totalQuestionsInRound: 2,
        },
        answers: [],
      }),
    );
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break', questionIndex: 1 },
        rounds: [
          {
            questions: [
              { prompt: 'Name a fruit', points: 1 },
              { prompt: 'Name a planet', points: 1 },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(await screen.findByText(/correct answer: banana/i)).toBeVisible();

    await userEvent.click(
      await screen.findByRole('button', {
        name: /grade question 2 of round 1/i,
      }),
    );

    expect(await screen.findByText(/correct answer: mars/i)).toBeVisible();
    expect(screen.queryByText(/correct answer: banana/i)).toBeNull();
  });

  it('shows a not-yet-graded dot only on questions listed in ungradedQuestionIds', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [
                { id: 1, prompt: 'Name a fruit', answer: 'Banana' },
                { id: 2, prompt: 'Name a planet', answer: 'Mars' },
              ],
            },
          ],
        },
      ],
    });
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'break', questionIndex: 1 },
        rounds: [
          {
            questions: [
              { prompt: 'Name a fruit', points: 1 },
              { prompt: 'Name a planet', points: 1 },
            ],
          },
        ],
        ungradedQuestionIds: [2],
      },
      connectionError: null,
      sendAction: vi.fn(),
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      await screen.findByRole('button', {
        name: /grade question 2 of round 1.*not yet graded/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /grade question 1 of round 1.*not yet graded/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('lets the admin grade any question at any game status, not just during a break', async () => {
    mockFetchQuizzes.mockResolvedValue({
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: true,
              questions: [
                { id: 1, prompt: 'Name a fruit', answer: 'Banana' },
                { id: 2, prompt: 'Name a planet', answer: 'Mars' },
              ],
            },
            {
              title: 'Round 2',
              breakAfter: true,
              questions: [
                { id: 'r2q1', prompt: 'Name this song.', answer: 'Yesterday' },
              ],
            },
          ],
        },
      ],
    });
    mockUseAdminGame.mockReturnValue({
      session: {
        joinCode: 'TESTCODE',
        progress: { status: 'question_open' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 1 }] }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: /grade question 1 of round 2/i,
      }),
    );

    await vi.waitFor(() =>
      expect(mockFetchAnswers).toHaveBeenCalledWith('TESTCODE', 'r2q1'),
    );
    expect(screen.getByText('Name this song.')).toBeInTheDocument();
  });
});
