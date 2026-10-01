import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GameProgress,
  PresenterContextPayload,
} from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import RemotePage from '@/app/remote/page';

const { mockUseAdminGame, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams('code=ABCDEF') },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-admin-game', async () => {
  const { adminGameResult } =
    await import('@/app/control/__tests__/test-utils');
  return {
    useAdminGame: (...args: unknown[]) =>
      adminGameResult(mockUseAdminGame(...args)),
  };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

function authenticatedAuthResult(
  overrides: Partial<UseAuthResult> = {},
): UseAuthResult {
  return {
    user: { id: 1, username: 'test-admin', role: 'admin', status: 'active' },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    // The server announces what the Advance slot and Previous do (admin
    // view); these fixtures just say both work.
    advanceStep: 'advance',
    previousState: 'available',
    progress: progress(),
    joinCode: 'ABCDEF',
    quizStructure: { breakRoundNumbers: [] },
    leaderboard: [],
    leaderboardRevealCount: 0,
    activeShowdown: null,
    showdownRevealStep: 0,
    ...overrides,
  };
}

function presenterContext(
  overrides: Partial<PresenterContextPayload> = {},
): PresenterContextPayload {
  return {
    currentQuestionNotes: null,
    currentScreen: { heading: 'R1 Q1' },
    nextScreen: null,
    ...overrides,
  };
}

describe('RemotePage — content', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
  });

  it('wires the Advance button to sendAction', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /advance/i }));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it.each([
    ['reveal_next_rank', /show next team/i],
    ['hide_leaderboard', /hide leaderboard/i],
  ] as const)(
    'labels the Advance slot from the announced %s step and sends ADVANCE',
    (advanceStep, label) => {
      const sendAction = vi.fn();
      mockUseAdminGame.mockReturnValue({
        snapshot: baseSnapshot({
          advanceStep,
          previousState: 'covered_by_leaderboard',
          progress: progress({ isLeaderboardVisible: true }),
        }),
        connectionError: null,
        sendAction,
        presenterContext: null,
      });
      renderWithQuery(<RemotePage />);

      fireEvent.click(screen.getByRole('button', { name: label }));

      expect(sendAction).toHaveBeenCalledTimes(1);
      expect(sendAction).toHaveBeenCalledWith('ADVANCE');
    },
  );

  it('hides the Advance slot when the announced step is none', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({ advanceStep: 'none' }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /advance|next team|hide/i }),
    ).not.toBeInTheDocument();
  });

  it('greys Previous out while the leaderboard covers the screen and hides it when unavailable', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        previousState: 'covered_by_leaderboard',
        progress: progress({ isLeaderboardVisible: true }),
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    const { unmount } = renderWithQuery(<RemotePage />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    unmount();

    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({ previousState: 'unavailable' }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);
    expect(
      screen.queryByRole('button', { name: /previous/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps a rejected Advance out of the connection banner', async () => {
    // The admin hook toasts the rejection itself; the page only ever shows
    // real connection problems in its banner.
    const sendAction = vi.fn(() =>
      Promise.resolve({ success: false as const, error: 'Cannot advance' }),
    );
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /advance/i }));

    await waitFor(() => expect(sendAction).toHaveBeenCalledWith('ADVANCE'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('wires the Previous button to sendAction', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
      }),
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('shows the current question notes when present', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        currentQuestionNotes: 'Remind teams: EU capitals only.',
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.getByText('Remind teams: EU capitals only.'),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no notes', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext(),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('No notes for this question.')).toBeInTheDocument();
  });

  it('shows what the display is currently showing', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        currentScreen: { heading: 'Break 1', body: 'After round 2' },
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Break 1')).toBeInTheDocument();
    expect(screen.getByText('After round 2')).toBeInTheDocument();
  });

  it('previews the next screen', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        nextScreen: {
          heading: 'Revealing · Round 1 title',
          body: 'Geography',
        },
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Revealing · Round 1 title')).toBeInTheDocument();
    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.queryByText('Nothing queued yet.')).not.toBeInTheDocument();
  });

  it('shows the full question preview when the next screen is a question', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        nextScreen: {
          heading: 'R1 Q2',
          question: {
            id: 22,
            type: 'free_text',
            prompt: 'Name the largest planet in the solar system.',
            points: 2,
            answer: 'Jupiter',
          },
        },
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('R1 Q2')).toBeInTheDocument();
    expect(
      screen.getByText('Name the largest planet in the solar system.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is queued next', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext(),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Nothing queued yet.')).toBeInTheDocument();
  });

  it('shows how many teams have answered while a question is open', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        teams: [
          { teamId: 1, teamName: 'The Quizzards', isConnected: true },
          { teamId: 2, teamName: 'Beer Necessities', isConnected: true },
          { teamId: 3, teamName: 'Quiz Pistols', isConnected: true },
        ],
        answeredTeamIds: [1, 2],
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('2/3 teams answered')).toBeInTheDocument();
  });

  it('shows how many teams answered correctly once graded', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 55,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London'],
        },
        teams: [
          { teamId: 1, teamName: 'The Quizzards', isConnected: true },
          { teamId: 2, teamName: 'Beer Necessities', isConnected: true },
        ],
        answeredTeamIds: [1, 2],
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: {
        questionId: 55,
        question: {
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          points: 2,
          correctAnswer: 'Paris',
          roundTitle: 'Geography',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 1,
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Paris',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'London',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'incorrect',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/1 correct/i)).toBeInTheDocument();
  });

  it('counts a speed-scaled kahoot answer with fewer than full points as correct', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 55,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London'],
        },
        teams: [
          { teamId: 1, teamName: 'The Quizzards', isConnected: true },
          { teamId: 2, teamName: 'Beer Necessities', isConnected: true },
        ],
        answeredTeamIds: [1, 2],
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: {
        questionId: 55,
        question: {
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          points: 1000,
          correctAnswer: 'Paris',
          roundTitle: 'Speed Round',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 1,
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Paris',
            pointsAwarded: 870,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'Paris',
            pointsAwarded: 520,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/2 correct/i)).toBeInTheDocument();
  });

  it('keeps showing the correct count once grading moves the question into break', () => {
    // The count is most useful once the admin is actually grading in
    // /control, which happens during 'break' — after the question has
    // closed and answeredTeamIds/currentQuestion have already cleared. It
    // must not be tied to showAnswerStatus the way the teams-answered line
    // is, or it disappears exactly when it becomes meaningful.
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        teams: [
          { teamId: 1, teamName: 'The Quizzards', isConnected: true },
          { teamId: 2, teamName: 'Beer Necessities', isConnected: true },
        ],
        answeredTeamIds: [],
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: {
        questionId: 55,
        question: {
          type: 'free_text',
          prompt: 'Capital of France?',
          points: 2,
          correctAnswer: 'Paris',
          roundTitle: 'Geography',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 1,
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Paris',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'London',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'incorrect',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/1 correct/i)).toBeInTheDocument();
  });

  it('omits the correct count when nothing has been submitted or graded yet', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 55,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London'],
        },
        teams: [{ teamId: 1, teamName: 'The Quizzards', isConnected: true }],
        answeredTeamIds: [],
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
  });

  it('hides the answered count once the question is no longer open', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'break' }),
        teams: [{ teamId: 1, teamName: 'The Quizzards', isConnected: true }],
        answeredTeamIds: [1],
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.queryByText(/teams answered/i)).not.toBeInTheDocument();
  });

  it('shows the elapsed time while a question/break is live', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        phaseStartedAt: Date.now() - 5_000,
        phaseElapsedMs: null,
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('0:05');
  });

  it('shows the final elapsed time once the phase is no longer live', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        phaseStartedAt: null,
        phaseElapsedMs: 125_000,
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('2:05');
  });

  it('shows no elapsed time for an untimed status', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'reveal' }),
        phaseStartedAt: null,
        phaseElapsedMs: null,
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.queryByTestId('phase-timer')).not.toBeInTheDocument();
  });

  it('shows a Play Again button for an open YouTube question and dispatches REPLAY_MEDIA', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 55,
          type: 'free_text',
          prompt: 'Name this music video.',
          mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        },
      }),
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /play video again/i }));

    expect(sendAction).toHaveBeenCalledWith('REPLAY_MEDIA');
  });

  it('hides the Play Again button for a non-YouTube question', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot({
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 55,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London'],
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /play video again/i }),
    ).not.toBeInTheDocument();
  });

  it('renders no grading, team, or leaderboard controls', () => {
    mockUseAdminGame.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /grade/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /kick/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /leaderboard/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument();
  });
});
