import { fireEvent, screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import RemotePage from '@/app/remote/page';

const { mockUseGameSocket, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseGameSocket: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams('code=ABCDEF') },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

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

describe('RemotePage — content', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
  });

  it('wires the Advance button to sendAction', () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /advance/i }));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('wires the Previous button to sendAction', () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
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
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: {
        currentQuestionNotes: 'Remind teams: EU capitals only.',
        nextQuestion: null,
      },
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.getByText('Remind teams: EU capitals only.'),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no notes', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: { currentQuestionNotes: null, nextQuestion: null },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('No notes for this question.')).toBeInTheDocument();
  });

  it('shows a preview of the next question when present', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: {
        currentQuestionNotes: null,
        nextQuestion: {
          id: 22,
          type: 'free_text',
          prompt: 'Name the largest planet in the solar system.',
          points: 2,
          answer: 'Jupiter',
        },
      },
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.getByText('Name the largest planet in the solar system.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is queued next', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: baseSnapshot(),
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: { currentQuestionNotes: null, nextQuestion: null },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Nothing queued yet.')).toBeInTheDocument();
  });

  it('shows how many teams have answered while a question is open', () => {
    mockUseGameSocket.mockReturnValue({
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
    mockUseGameSocket.mockReturnValue({
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
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'London',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/1 correct/i)).toBeInTheDocument();
  });

  it('keeps showing the correct count once grading moves the question into break', () => {
    // The count is most useful once the admin is actually grading in
    // /control, which happens during 'break' — after the question has
    // closed and answeredTeamIds/currentQuestion have already cleared. It
    // must not be tied to showAnswerStatus the way the teams-answered line
    // is, or it disappears exactly when it becomes meaningful.
    mockUseGameSocket.mockReturnValue({
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
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'London',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/1 correct/i)).toBeInTheDocument();
  });

  it('omits the correct count when nothing has been submitted or graded yet', () => {
    mockUseGameSocket.mockReturnValue({
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
    mockUseGameSocket.mockReturnValue({
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

  it('renders no grading, team, or leaderboard controls', () => {
    mockUseGameSocket.mockReturnValue({
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
