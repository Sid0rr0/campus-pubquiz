import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes, mockUseAuth, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
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

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AdminPage — grading', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows live answers for the current question with team name and value', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
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

    expect(screen.getAllByText('The Quizzards').length).toBeGreaterThan(0);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('shows every team even if it has not answered yet, and the round, question number and correct answer', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
      liveAnswers: {
        questionId: 'r1q1',
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

    expect(screen.getByText(/round 2 \(fruit & veg\)/i)).toHaveTextContent('Q3 of 4');
    expect(screen.getByText(/correct answer: banana/i)).toBeInTheDocument();
    expect(screen.getByText('No answer yet')).toBeInTheDocument();

    const unansweredRow = screen.getByText('No answer yet').closest('li');
    expect(unansweredRow).toHaveClass('opacity-40');
    expect(unansweredRow).toHaveTextContent('Beer Necessities');
    expect(
      screen.getByRole('button', { name: /grade beer necessities full points/i }),
    ).toBeDisabled();
  });

  it('grades an ungraded answer with the full-points quick button', async () => {
    const gradeAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
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
      gradeAnswer,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /grade the quizzards full points/i }));

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 2);
  });

  it('grades an ungraded answer with the half-points quick button', async () => {
    const gradeAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
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
      gradeAnswer,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /grade the quizzards half points/i }));

    expect(gradeAnswer).toHaveBeenCalledWith('answer-1', 1);
  });

  it('shows the awarded grade as a disabled, checked quick button for an already-graded answer', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 2 },
        ],
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers: vi.fn(),
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
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    const fullPointsButton = screen.getByRole('button', { name: /grade the quizzards full points/i });
    expect(fullPointsButton).toHaveTextContent('✓ 2');
    expect(fullPointsButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /grade the quizzards 0 points/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /grade the quizzards half points/i })).toBeDisabled();
  });

  it('requests and shows the first block question answers during the grading break', () => {
    const listAnswers = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', questionIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a planet', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    expect(listAnswers).toHaveBeenCalledWith('r1q1');
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('browses to another question via the round number picker', async () => {
    const listAnswers = vi.fn();
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
        progress: progress({ status: 'break', questionIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          { id: 'r1q2', type: 'free_text', prompt: 'Name a planet', points: 1 },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: /grade question 2 of round 1/i }),
    );

    expect(listAnswers).toHaveBeenCalledWith('r1q2');
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });

  it('lets the admin grade any question at any game status, not just during a break', async () => {
    const listAnswers = vi.fn();
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
              questions: [{ id: 'r2q1', prompt: 'Name this song.', answer: 'Yesterday' }],
            },
          ],
        },
      ],
    });
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      listAnswers,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: /grade question 1 of round 2/i }),
    );

    expect(listAnswers).toHaveBeenCalledWith('r2q1');
    expect(screen.getByText('Name this song.')).toBeInTheDocument();
  });
});
