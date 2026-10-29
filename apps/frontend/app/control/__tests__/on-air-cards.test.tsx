import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test-utils/query';
import AdminPage from '@/app/control/page';
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
          note: 'Play the jingle first.',
          category: 'Pop',
          author: 'Sam',
          breakAfter: false,
          questions: [{ id: 1, prompt: 'Band?', answer: 'ABBA' }],
        },
        {
          title: 'Sport',
          breakAfter: false,
          breakNumber: 1,
          isFinalBreak: true,
          questions: [{ id: 2, prompt: 'Sport?', answer: 'Golf' }],
        },
      ],
    },
  ],
};

const LIVE_ANSWERS = {
  questionId: 1,
  question: {
    type: 'free_text',
    prompt: 'Band?',
    points: 1,
    correctAnswer: 'ABBA',
    roundTitle: 'Music',
    roundNumber: 1,
    questionNumberInRound: 1,
    totalQuestionsInRound: 1,
  },
  answers: [
    {
      answerId: 'answer-1',
      teamId: 1,
      teamName: 'The Quizzards',
      value: 'ABBA',
      pointsAwarded: 0,
      gradedAt: null,
      gradingState: 'ungraded',
    },
  ],
};

function mockStatus(status: string, roundIndex: number, liveAnswers = null) {
  mockUseAdminGame.mockReturnValue({
    session: {
      joinCode: 'TESTCODE',
      progress: { status, roundIndex, questionIndex: 0 },
      rounds: [
        { questions: [{ prompt: 'Band?', points: 1 }] },
        { questions: [{ prompt: 'Sport?', points: 1 }] },
      ],
    },
    liveAnswers,
  });
}

function renderStatus(
  status: string,
  roundIndex = 0,
  liveAnswers: unknown = null,
) {
  mockStatus(status, roundIndex, liveAnswers as null);
  const result = renderWithQuery(<AdminPage />);
  return {
    // Brings the big screen to another status, as Advance/Previous would.
    moveTo(next: string, nextRound: number) {
      mockStatus(next, nextRound, liveAnswers as null);
      result.rerender(<AdminPage />);
    },
  };
}

describe('AdminPage — on-air title and break cards', () => {
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

  it.each([
    ['round_intro', 'Round intro'],
    ['reveal_intro', 'Reveal intro'],
    ['break_round_intro', 'Break review: round intro'],
  ])(
    'shows the title card with its kind and every round field on %s',
    async (status, label) => {
      renderStatus(status);

      const card = await screen.findByRole('region', { name: 'Title card' });
      expect(card).toHaveTextContent(label);
      expect(card).toHaveTextContent('Round 1: Music');
      expect(card).toHaveTextContent('Pop');
      expect(card).toHaveTextContent('Sam');
      expect(card).toHaveTextContent('Play the jingle first.');
      expect(
        screen.queryByRole('region', { name: 'Question detail' }),
      ).not.toBeInTheDocument();
      expect(mockFetchAnswers).not.toHaveBeenCalled();
    },
  );

  it('shows the final break as "Break 1 (final)" on the break', async () => {
    renderStatus('break_intro', 1);

    expect(
      await screen.findByRole('region', { name: 'Break card' }),
    ).toHaveTextContent('Break 1 (final)');
  });

  it('shows a browsed title card without a kind, and Round note nowhere else', async () => {
    renderStatus('round_intro');

    await userEvent.click(
      await screen.findByRole('button', { name: /show title card of sport/i }),
    );

    const card = screen.getByRole('region', { name: 'Title card' });
    expect(card).toHaveTextContent('Round 2: Sport');
    expect(card).not.toHaveTextContent('Round intro');
  });

  it('shows a browsed break card when its B marker is clicked', async () => {
    renderStatus('round_intro');

    await userEvent.click(
      await screen.findByRole('button', { name: /show break after sport/i }),
    );

    expect(
      screen.getByRole('region', { name: 'Break card' }),
    ).toHaveTextContent('Break 1 (final)');
  });

  it('highlights the selected T marker and keeps the on-air ring on the on-air one', async () => {
    renderStatus('round_intro');
    const music = await screen.findByRole('button', {
      name: /show title card of music/i,
    });
    const sport = screen.getByRole('button', {
      name: /show title card of sport/i,
    });
    expect(music).toHaveAccessibleName(/live on display/);
    expect(music).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(sport);

    expect(sport).toHaveAttribute('aria-pressed', 'true');
    expect(music).toHaveAttribute('aria-pressed', 'false');
    expect(music).toHaveAccessibleName(/live on display/);
    expect(sport).not.toHaveAccessibleName(/live on display/);
  });

  it('shows no grading list while a browsed card is shown', async () => {
    renderStatus('round_intro', 0, LIVE_ANSWERS);
    await screen.findByRole('region', { name: 'Title card' });

    await userEvent.click(
      screen.getByRole('button', { name: /show title card of sport/i }),
    );

    expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
  });

  it('follows the big screen again once Advance reaches the browsed title card', async () => {
    const game = renderStatus('round_intro');
    await userEvent.click(
      await screen.findByRole('button', { name: /show title card of sport/i }),
    );
    expect(
      screen.getByRole('region', { name: 'Title card' }),
    ).not.toHaveTextContent('Round intro');

    game.moveTo('round_intro', 1);
    expect(
      screen.getByRole('region', { name: 'Title card' }),
    ).toHaveTextContent('Round intro');

    // Previous: the pick was dropped, so the card follows the screen back.
    game.moveTo('round_intro', 0);
    expect(
      screen.getByRole('region', { name: 'Title card' }),
    ).toHaveTextContent('Round 1: Music');
  });

  it('follows the big screen again once Advance reaches the browsed break', async () => {
    const game = renderStatus('round_intro');
    await userEvent.click(
      await screen.findByRole('button', { name: /show break after sport/i }),
    );
    expect(
      screen.getByRole('region', { name: 'Break card' }),
    ).toBeInTheDocument();

    game.moveTo('break_intro', 1);
    expect(
      screen.getByRole('region', { name: 'Break card' }),
    ).toBeInTheDocument();

    game.moveTo('round_intro', 0);
    expect(
      screen.getByRole('region', { name: 'Title card' }),
    ).toHaveTextContent('Round 1: Music');
  });
});
