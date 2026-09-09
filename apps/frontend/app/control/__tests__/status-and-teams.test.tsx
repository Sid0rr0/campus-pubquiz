import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import { authenticatedAuthResult, progress } from './test-utils';

const { mockUseGameSocket, mockFetchQuizzes, mockUseAuth, searchParamsRef } =
  vi.hoisted(() => ({
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

describe('AdminPage — status and teams', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows the current status and question once connected', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
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
    renderWithQuery(<AdminPage />);
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
    renderWithQuery(<AdminPage />);

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveTextContent(/teams \(2\)/i);
    expect(sidebar).toHaveTextContent('The Quizzards');
    expect(sidebar).toHaveTextContent('Beer Necessities');
  });

  it('marks the teams that have answered the current question in the sidebar', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r1q1',
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
        },
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
        answeredTeamIds: ['team-1'],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      screen.getByRole('listitem', { name: /the quizzards has answered/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', {
        name: /beer necessities has not answered yet/i,
      }),
    ).toBeInTheDocument();
  });

  it('shows how many teams have answered next to the Teams heading', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r1q1',
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
        },
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
        answeredTeamIds: ['team-1'],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    // The sidebar also has a "Teams (N)" heading — the main section's
    // heading (next to the teams table) is the one without a team count in
    // parens, so it's picked out by that rather than by role name alone.
    const mainTeamsHeading = screen
      .getAllByRole('heading', { name: /teams/i })
      .find((heading) => !heading.textContent?.includes('('));
    expect(mainTeamsHeading).toHaveTextContent('1/2 answered');
  });

  it('hides the answered count next to the Teams heading when no question is open', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
        answeredTeamIds: [],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    const mainTeamsHeading = screen
      .getAllByRole('heading', { name: /teams/i })
      .find((heading) => !heading.textContent?.includes('('));
    expect(mainTeamsHeading).not.toHaveTextContent(/answered/i);
  });
});
