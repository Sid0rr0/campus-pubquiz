import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test-utils/query';
import AdminPage from '@/app/control/page';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';
import { authenticatedAuthResult } from './test-utils';

const { mockUseAdminGame, mockFetchQuizzes, mockFetchAnswers, mockUseAuth } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockFetchQuizzes: vi.fn(),
    mockFetchAnswers: vi.fn(),
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
  return { ...actual, fetchAnswers: mockFetchAnswers };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('code=TESTCODE'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const QUIZ = {
  activeQuizId: 'quiz-1',
  quizzes: [
    {
      id: 'quiz-1',
      title: 'Campus Pub Quiz Night',
      rounds: [
        {
          title: 'Music',
          breakAfter: false,
          questions: [{ id: 1, prompt: 'Band?', answer: 'ABBA' }],
        },
        {
          title: 'Sport',
          breakAfter: false,
          questions: [{ id: 2, prompt: 'Sport?', answer: 'Golf' }],
        },
      ],
    },
  ],
};

const team = (
  teamId: number,
  teamName: string,
  rank: number,
  callouts: string[],
) => ({
  teamId,
  teamName,
  rank,
  rankTo: rank,
  totalPoints: 10 * teamId,
  callouts,
});

const LIVE_RANK_BOARD = {
  current: {
    rank: 3,
    teams: [team(1, 'Quizzly Bears', 3, ['+4 this block', 'up from 5th'])],
  },
  next: { rank: 2, teams: [team(2, 'The Quizzards', 2, ['holds 2nd'])] },
};

function mockBoard(liveRankBoard: unknown) {
  // The server decides the board; here the admin view just carries it.
  const view = roomView(SOCKET_ROOMS.ADMIN, {
    joinCode: 'TESTCODE',
    progress: { status: 'reveal', roundIndex: 0, questionIndex: 0 },
    rounds: [
      { questions: [{ prompt: 'Band?', points: 1 }] },
      { questions: [{ prompt: 'Sport?', points: 1 }] },
    ],
  });
  mockUseAdminGame.mockReturnValue({
    snapshot: { ...view, ...(liveRankBoard ? { liveRankBoard } : {}) },
    liveAnswers: null,
  });
}

describe('AdminPage — live leaderboard card', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockReset();
    mockFetchQuizzes.mockResolvedValue(QUIZ);
    mockFetchAnswers.mockReset();
    mockFetchAnswers.mockResolvedValue(null);
  });

  it('shows the revealed group large with its callouts and the next group dimmed', async () => {
    mockBoard(LIVE_RANK_BOARD);
    renderWithQuery(<AdminPage />);

    const current = await screen.findByRole('region', { name: 'Revealed' });
    expect(current).toHaveTextContent('Quizzly Bears');
    expect(current).toHaveTextContent('+4 this block');
    expect(current).toHaveTextContent('up from 5th');
    expect(current).not.toHaveClass('opacity-50');
    const next = screen.getByRole('region', { name: 'Next' });
    expect(next).toHaveTextContent('The Quizzards');
    expect(next).toHaveTextContent('holds 2nd');
    expect(next).toHaveClass('opacity-50');
  });

  it('names every place a tied group fills, worst first, and spells out points', async () => {
    mockBoard({
      current: {
        rank: 2,
        teams: [
          { ...team(1, 'Quizzly Bears', 2, []), totalPoints: 1 },
          team(2, 'The Quizzards', 2, []),
        ],
      },
      next: { rank: 1, teams: [team(3, 'Sim Team 3', 1, [])] },
    });
    renderWithQuery(<AdminPage />);

    const current = await screen.findByRole('region', { name: 'Revealed' });
    expect(current).toHaveTextContent('Revealed · 3rd - 2nd');
    expect(current).toHaveTextContent('Quizzly Bears · 1 point');
    expect(current).toHaveTextContent('The Quizzards · 20 points');
    expect(screen.getByRole('region', { name: 'Next' })).toHaveTextContent(
      'Next · 1st',
    );
  });

  it('says the facts tied teams share once, below the names, and keeps each team’s own', async () => {
    mockBoard({
      current: {
        rank: 2,
        teams: [
          team(1, 'Quizzly Bears', 2, ['+4 this block', 'holds 2nd']),
          team(2, 'The Quizzards', 2, ['+6 this block', 'holds 2nd']),
        ],
      },
      next: null,
    });
    renderWithQuery(<AdminPage />);

    const current = await screen.findByRole('region', { name: 'Revealed' });
    const items = within(current)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items).toEqual(['+4 this block', '+6 this block', 'holds 2nd']);
  });

  it('shows the all-at-once quickfire board with every group at full strength', async () => {
    mockBoard({
      current: null,
      next: null,
      all: [
        { rank: 1, teams: [team(1, 'Quizzly Bears', 1, ['+9'])] },
        { rank: 2, teams: [team(2, 'The Quizzards', 2, ['+3'])] },
      ],
    });
    renderWithQuery(<AdminPage />);

    const groups = await screen.findAllByRole('region', { name: 'Board' });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('Quizzly Bears');
    expect(groups[0]).toHaveTextContent('+9');
    expect(groups[1]).not.toHaveClass('opacity-50');
    expect(
      screen.queryByRole('region', { name: 'Revealed' }),
    ).not.toBeInTheDocument();
  });

  it('shows no card without a live board', async () => {
    mockBoard(undefined);
    renderWithQuery(<AdminPage />);

    await screen.findByRole('button', { name: /show title card of sport/i });
    expect(
      screen.queryByRole('region', { name: 'Leaderboard card' }),
    ).not.toBeInTheDocument();
  });

  it('keeps a manually picked item until the big screen reaches it', async () => {
    mockBoard(undefined);
    const result = renderWithQuery(<AdminPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /show title card of sport/i }),
    );

    mockBoard(LIVE_RANK_BOARD);
    result.rerender(<AdminPage />);

    expect(
      screen.getByRole('region', { name: 'Title card' }),
    ).toHaveTextContent('Round 2: Sport');
    expect(
      screen.queryByRole('region', { name: 'Leaderboard card' }),
    ).not.toBeInTheDocument();
  });
});
