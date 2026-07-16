import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';

const { mockUseGameSocket } = vi.hoisted(() => ({ mockUseGameSocket: vi.fn() }));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    ...overrides,
  };
}

describe('PlayPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
      team: null,
      joinTeam: vi.fn(),
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
  });

  it('shows a join form when no team name is stored', () => {
    render(<PlayPage />);
    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
  });

  it('stores the team name and switches to the game view after joining', async () => {
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('The Quizzards');
    expect(screen.getByText(/playing as the quizzards/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the trimmed name when submitting the join form', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
      team: null,
      joinTeam,
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), '  The Quizzards  ');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).toHaveBeenCalledWith('The Quizzards', undefined);
  });

  it('skips the join form when a team name is already stored (reconnect)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /team name/i })).not.toBeInTheDocument();
    expect(screen.getByText(/playing as returning team/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the stored name and token on reconnect', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
      team: null,
      joinTeam,
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });

    render(<PlayPage />);

    expect(joinTeam).toHaveBeenCalledWith('Returning Team', 'stored-token');
  });

  it('shows the current question once joined and connected', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      team: null,
      joinTeam: vi.fn(),
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows a free-text answer form once the team has joined and a question is open', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      joinTeam: vi.fn(),
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.getByRole('textbox', { name: /your answer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('submits the typed free-text answer with the question and team id', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      joinTeam: vi.fn(),
      submitAnswer,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /your answer/i }), 'Banana');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', 'Banana');
  });

  it('shows multiple-choice options and submits the chosen option immediately', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r1q1',
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          points: 2,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
      team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      joinTeam: vi.fn(),
      submitAnswer,
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Paris' }));

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', 'Paris');
  });

  it('does not show an answer form while answers are locked', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'locked' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      joinTeam: vi.fn(),
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/answers locked/i)).toBeInTheDocument();
  });

  it('does not show an answer form before the team identity has been confirmed', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      team: null,
      joinTeam: vi.fn(),
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
      team: null,
      joinTeam: vi.fn(),
      submitAnswer: vi.fn(),
      liveAnswers: null,
      gradeAnswer: vi.fn(),
    });
    render(<PlayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });
});
