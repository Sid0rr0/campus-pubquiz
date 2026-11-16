import { screen } from '@testing-library/react';
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
          breakAfter: true,
          breakNumber: 1,
          questions: [{ id: 1, prompt: 'Band?', answer: 'ABBA' }],
        },
        {
          title: 'Sport',
          breakAfter: true,
          breakNumber: 2,
          isFinalBreak: true,
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
  extra: Record<string, unknown> = {},
) => ({
  teamId,
  teamName,
  rank,
  rankTo: rank,
  totalPoints: 10 * teamId,
  callouts: [`${teamName} line`],
  ...extra,
});

const board = (roundIndex: number, extra: Record<string, unknown> = {}) => ({
  roundIndex,
  blockFirstQuestionId: roundIndex + 1,
  isReached: true,
  isFinal: false,
  isGradingUnfinished: false,
  isOnAir: false,
  groups: [
    { rank: 2, teams: [team(2, 'Quizzards', 2, { hasLeft: true })] },
    { rank: 1, teams: [team(1, 'Bears', 1)] },
  ],
  ...extra,
});

function mockBoards(blockBoards: unknown[]) {
  const view = roomView(SOCKET_ROOMS.ADMIN, {
    joinCode: 'TESTCODE',
    progress: { status: 'reveal', roundIndex: 0, questionIndex: 0 },
    rounds: [
      { questions: [{ prompt: 'Band?', points: 1 }] },
      { questions: [{ prompt: 'Sport?', points: 1 }] },
    ],
  });
  mockUseAdminGame.mockReturnValue({
    snapshot: { ...view, blockBoards },
    liveAnswers: null,
  });
}

describe('AdminPage — block board markers', () => {
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

  it('puts a marker after each break marker', async () => {
    mockBoards([board(0), board(1, { isReached: false, groups: [] })]);
    renderWithQuery(<AdminPage />);

    const nav = await screen.findByRole('navigation', {
      name: 'Music questions',
    });
    const labels = Array.from(nav.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels.at(-2)).toMatch(/show break after music/i);
    expect(labels.at(-1)).toMatch(/show leaderboard after music/i);
  });

  it('greys out the marker of a block not reached', async () => {
    mockBoards([board(0), board(1, { isReached: false, groups: [] })]);
    renderWithQuery(<AdminPage />);

    expect(
      await screen.findByRole('button', { name: /leaderboard after sport/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /leaderboard after music/i }),
    ).toBeEnabled();
  });

  it('previews the clicked block board bottom-up with its callouts and left tag', async () => {
    mockBoards([board(0), board(1, { isReached: false, groups: [] })]);
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: /leaderboard after music/i }),
    );

    const card = screen.getByRole('region', { name: 'Block board card' });
    const groups = screen.getAllByRole('region', { name: 'Board' });
    expect(groups[0]).toHaveTextContent('Quizzards');
    expect(groups[0]).toHaveTextContent('left');
    expect(groups[0]).toHaveTextContent('Quizzards line');
    expect(groups[1]).toHaveTextContent('Bears');
    expect(card).not.toHaveTextContent(/grading not finished/i);
  });

  it('tags the block in play while grading is unfinished', async () => {
    mockBoards([
      board(0, { isGradingUnfinished: true }),
      board(1, { isReached: false, groups: [] }),
    ]);
    renderWithQuery(<AdminPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: /leaderboard after music/i }),
    );

    expect(
      screen.getByRole('region', { name: 'Block board card' }),
    ).toHaveTextContent(/grading not finished/i);
  });

  it('rings the marker of the board on the big screen', async () => {
    mockBoards([
      board(0, { isOnAir: true }),
      board(1, { isReached: false, groups: [] }),
    ]);
    renderWithQuery(<AdminPage />);

    expect(
      await screen.findByRole('button', {
        name: 'Show leaderboard after Music (live on display)',
      }),
    ).toHaveClass('ring-green-500');
  });
});
