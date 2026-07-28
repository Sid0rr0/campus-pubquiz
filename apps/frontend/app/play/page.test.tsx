import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
}));

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    ...overrides,
  };
}

function socketResult(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: null,
    connectionError: null,
    sendAction: vi.fn(),
    team: null,
    joinTeam: vi.fn(),
    submitAnswer: vi.fn(),
    liveAnswers: null,
    gradeAnswer: vi.fn(),
    myAnswers: {},
    ...overrides,
  };
}

describe('PlayPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('shows a join form asking for a team name and a game code', () => {
    render(<PlayPage />);
    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /game code/i })).toBeInTheDocument();
  });

  it('stores the team name and game code and switches to the game view after joining', async () => {
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'ABCDEF');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('The Quizzards');
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBe('ABCDEF');
    expect(screen.getByText(/playing as the quizzards/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the trimmed name and normalized game code when submitting', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), '  The Quizzards  ');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), ' abcdef ');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).toHaveBeenCalledWith('The Quizzards', { joinCode: 'ABCDEF' });
  });

  it('does not join when the game code is empty', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).not.toHaveBeenCalled();
  });

  it('prefills the game code from the ?code= query parameter (QR scan)', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<PlayPage />);

    expect(screen.getByRole('textbox', { name: /game code/i })).toHaveValue('ABCDEF');
  });

  it('skips the join form when a team name is already stored (reconnect)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /team name/i })).not.toBeInTheDocument();
    expect(screen.getByText(/playing as returning team/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the stored name, token and join code on reconnect', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));

    render(<PlayPage />);

    expect(joinTeam).toHaveBeenCalledWith('Returning Team', {
      teamToken: 'stored-token',
      joinCode: 'ABCDEF',
    });
  });

  it('re-joins with the stored name, token and join code when the game returns to the lobby', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    const joinTeam = vi.fn();
    const joinedTeam = { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'stored-token' };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
        team: joinedTeam,
        joinTeam,
      }),
    );
    const { rerender } = render(<PlayPage />);
    joinTeam.mockClear();

    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
        team: joinedTeam,
        joinTeam,
      }),
    );
    rerender(<PlayPage />);

    expect(joinTeam).toHaveBeenCalledWith('Returning Team', {
      teamToken: 'stored-token',
      joinCode: 'ABCDEF',
    });
  });

  it('shows the rules screen after the lobby, before the first question opens', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'rules' }),
          currentQuestion: null,
          quizStructure: { blockCount: 2, topicsPerBlock: 3 },
        },
        team: { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 'token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/2 rounds of 3 topics/i)).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('shows a link to the rules page while waiting in the lobby', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
        team: { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 'token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByRole('link', { name: /read the rules/i })).toHaveAttribute(
      'href',
      '/rules',
    );
  });

  it('shows the join error and returns to the join form on "start over"', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-join-code', 'STALE1');
    mockUseGameSocket.mockReturnValue(
      socketResult({ connectionError: 'Invalid join code' }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/invalid join code/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /start over/i }));

    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBeNull();
  });

  it('shows the current question once joined and connected', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows a hint to look at the big screen for a picture question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r2q1',
            type: 'picture',
            prompt: 'Which landmark is shown?',
            mediaUrl: 'https://example.com/landmark.jpg',
            points: 3,
          },
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('shows a hint to look at the big screen for an audio question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r2q2',
            type: 'audio',
            prompt: 'Name this song.',
            mediaUrl: 'https://example.com/song.mp3',
            points: 3,
          },
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('does not show the screen hint for a free-text question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByText(/look at the screen/i)).not.toBeInTheDocument();
  });

  it('shows a free-text answer form once the team has joined and a question is open', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByRole('textbox', { name: /your answer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('submits the typed free-text answer with the question and team id', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        submitAnswer,
      }),
    );
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /your answer/i }), 'Banana');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', 'Banana');
  });

  it('shows multiple-choice options and submits the chosen option immediately', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
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
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        submitAnswer,
      }),
    );
    render(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Paris' }));

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', 'Paris');
  });

  it('indicates which option the team chose on a multiple-choice question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
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
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        myAnswers: { r1q1: 'Paris' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByRole('button', { name: 'Paris' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'London' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a navigator for revealed block questions with answered questions marked', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const q1 = { id: 'r1q1', type: 'free_text' as const, prompt: 'Name a fruit', points: 1 };
    const q2 = { id: 'r1q2', type: 'free_text' as const, prompt: 'Name a planet', points: 1 };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', questionIndex: 1 }),
          currentQuestion: q2,
          blockQuestions: [q1, q2],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        myAnswers: { r1q1: 'Banana' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByRole('button', { name: /question 1 \(answered\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^question 2$/i })).toBeInTheDocument();
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });

  it('lets the team browse back to an earlier open question and revise its answer', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    const q1 = { id: 'r1q1', type: 'free_text' as const, prompt: 'Name a fruit', points: 1 };
    const q2 = { id: 'r1q2', type: 'free_text' as const, prompt: 'Name a planet', points: 1 };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open', questionIndex: 1 }),
          currentQuestion: q2,
          blockQuestions: [q1, q2],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        submitAnswer,
        myAnswers: { r1q1: 'Banana' },
      }),
    );
    render(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: /question 1 \(answered\)/i }));

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveValue('Banana');

    await userEvent.clear(screen.getByRole('textbox', { name: /your answer/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /your answer/i }), 'Apple');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(submitAnswer).toHaveBeenCalledWith('r1q1', 'team-1', 'Apple');
  });

  it('tells the team answers are locked during the grading break', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'break' }),
          currentQuestion: null,
          blockQuestions: [
            { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
          ],
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/answers are locked/i)).toBeInTheDocument();
  });

  it('does not show an answer form before the team identity has been confirmed', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
      }),
    );
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ isLeaderboardVisible: true }), currentQuestion: null },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });
});
