import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';
import AdminPage from './page';

const { mockUseGameSocket } = vi.hoisted(() => ({ mockUseGameSocket: vi.fn() }));

vi.mock('../lib/use-game-socket', () => ({
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

describe('AdminPage', () => {
  it('shows a connecting message before the first snapshot arrives', () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<AdminPage />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows the current status and question once connected', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);
    expect(screen.getByText(/question_open/i)).toBeInTheDocument();
    expect(screen.getByText(/name a fruit/i)).toBeInTheDocument();
  });

  it('surfaces a connection error as an alert', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: 'Only admin clients may perform game actions',
      sendAction: vi.fn(),
    });
    render(<AdminPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/only admin clients/i);
  });

  it('sends START_QUIZ when the Start Quiz button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /start quiz/i }));

    expect(sendAction).toHaveBeenCalledWith('START_QUIZ');
  });

  it('sends ADVANCE when the Advance button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'locked' }), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /advance/i }));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends TOGGLE_LEADERBOARD when the Toggle Leaderboard button is clicked', async () => {
    const sendAction = vi.fn();
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress(), currentQuestion: null },
      connectionError: null,
      sendAction,
    });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /toggle leaderboard/i }));

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });
});
