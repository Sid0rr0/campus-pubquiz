import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchQuizzes: vi.fn(),
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});

describe('AdminPage — status and teams', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows the current status and question once connected', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
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
        answers: [],
      },
      gradeAnswer: vi.fn(),
    });
    render(<AdminPage />);
    expect(screen.getByText(/question_open/i)).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('lists the connected team names in the sidebar', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveTextContent(/teams \(2\)/i);
    expect(sidebar).toHaveTextContent('The Quizzards');
    expect(sidebar).toHaveTextContent('Beer Necessities');
  });

  it('marks the teams that have answered the current question in the sidebar', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
        answeredTeamIds: ['team-1'],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(screen.getByRole('listitem', { name: /the quizzards has answered/i })).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: /beer necessities has not answered yet/i }),
    ).toBeInTheDocument();
  });
});
