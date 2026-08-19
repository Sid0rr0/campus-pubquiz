import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, progress } from './test-utils';

const {
  mockUseGameSocket,
  mockFetchQuizzes,
  mockFetchAnswers,
  mockUseAuth,
  searchParamsRef,
} = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  mockFetchAnswers: vi.fn(),
  mockUseAuth: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('code=TESTCODE') },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

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
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
    mockFetchAnswers.mockReset();
    mockFetchAnswers.mockResolvedValue(null);
  });

  it('requests and shows the first block question answers during the grading break', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        joinCode: 'TESTCODE',
        progress: progress({ status: 'break', questionIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a planet', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    await vi.waitFor(() =>
      expect(mockFetchAnswers).toHaveBeenCalledWith('TESTCODE', 'r1q1'),
    );
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('keeps showing the last question answers for grading once the quiz has ended', async () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        joinCode: 'TESTCODE',
        progress: progress({ status: 'ended', isLeaderboardVisible: true }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
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
            teamId: 'team-1',
            teamName: 'The Quizzards',
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getByText('Banana')).toBeInTheDocument();
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
                { id: 'r1q1', prompt: 'Name a fruit', answer: 'Banana' },
                { id: 'r1q2', prompt: 'Name a planet', answer: 'Mars' },
              ],
            },
          ],
        },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        joinCode: 'TESTCODE',
        progress: progress({ status: 'break', questionIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a planet', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: /grade question 2 of round 1/i,
      }),
    );

    await vi.waitFor(() =>
      expect(mockFetchAnswers).toHaveBeenCalledWith('TESTCODE', 'r1q2'),
    );
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
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
                { id: 'r1q1', prompt: 'Name a fruit', answer: 'Banana' },
                { id: 'r1q2', prompt: 'Name a planet', answer: 'Mars' },
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
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        joinCode: 'TESTCODE',
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r1q1',
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
      setLiveAnswers: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

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
