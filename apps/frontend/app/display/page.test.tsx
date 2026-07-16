import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameProgress, QuestionView } from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';

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

const question: QuestionView = {
  id: 'r1q1',
  type: 'multiple_choice',
  prompt: 'Capital of France?',
  options: ['Paris', 'London'],
  points: 2,
};

describe('DisplayPage', () => {
  it('shows a connecting message before the first snapshot arrives', () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<DisplayPage />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows a waiting message in the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });

  it('shows the current question and its options while open', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: question },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('London')).toBeInTheDocument();
  });

  it('shows a locked indicator once answers are locked', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'locked' }), currentQuestion: question },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/locked/i)).toBeInTheDocument();
  });

  it('shows a grading message during a break', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'break' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/grading/i)).toBeInTheDocument();
  });

  it('shows a completion message once the quiz has ended', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true, regardless of status', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open', isLeaderboardVisible: true }),
        currentQuestion: question,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });
});
