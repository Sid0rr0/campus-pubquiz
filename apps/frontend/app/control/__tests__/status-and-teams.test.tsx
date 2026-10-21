import { screen, waitFor, within } from '@testing-library/react';
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

vi.mock('@/app/lib/answer-api', async () =>
  (await import('@/test-utils/answer-api-offline')).createOfflineAnswerApi(),
);

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('@/app/lib/leagues-api', () => ({
  fetchLeagues: () => Promise.resolve({ items: [] }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AdminPage — status and teams', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows the current status and question once connected', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 1 }] }],
      },
      connectionError: null,
      sendAction: vi.fn(),
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
        answers: [],
      },
      gradeAnswer: vi.fn(),
    });
    renderWithQuery(<AdminPage />);
    expect(screen.getByText(/question_open/i)).toBeInTheDocument();
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('lists the connected team names in the sidebar', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'lobby' },
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
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

  describe('teams table round columns', () => {
    const roundHeaders = () =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
        .filter((text) => /^\d+$/.test(text ?? ''));

    function mockSession() {
      mockUseAdminGame.mockReturnValue({
        session: {
          progress: { status: 'question_open' },
          rounds: [
            { title: 'Music', questions: [{}] },
            { title: 'Music', questions: [{}] },
            { title: 'Film', questions: [{}] },
          ],
          leaderboard: [
            {
              teamName: 'The Quizzards',
              totalPoints: 9,
              roundPoints: [
                { roundTitle: 'Music', points: 2 },
                { roundTitle: 'Music', points: 7 },
              ],
            },
          ],
        },
      });
    }

    it('renders a column per round of the view while the quiz list is still empty', () => {
      mockFetchQuizzes.mockReturnValue(new Promise(() => {}));
      mockSession();
      renderWithQuery(<AdminPage />);

      expect(roundHeaders()).toEqual(['1', '2', '3']);
      const cells = within(
        screen.getByText('The Quizzards', { selector: 'td' }).closest('tr')!,
      )
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
      expect(cells.slice(2, 5)).toEqual(['2', '7', '0']);
    });

    it('follows the view when the quiz list has a different number of rounds', async () => {
      mockFetchQuizzes.mockResolvedValue({
        activeQuizId: 1,
        quizzes: [
          {
            id: 1,
            title: 'Stale quiz',
            rounds: [{ id: 1, title: 'Music', questions: [] }],
          },
        ],
      });
      mockSession();
      renderWithQuery(<AdminPage />);

      await waitFor(() => expect(mockFetchQuizzes).toHaveBeenCalled());
      await screen.findByText(/stale quiz/i);
      expect(roundHeaders()).toEqual(['1', '2', '3']);
    });
  });

  it('marks the teams that have answered the current question in the sidebar', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [{ questions: [{ prompt: 'Name a fruit', points: 1 }] }],
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
        answeredTeams: { 1: [1] },
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
});
