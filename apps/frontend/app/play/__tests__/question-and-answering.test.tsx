import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('PlayPage — question and answering', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
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

  it('keeps showing the question and answer form during the locking countdown', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'locking' }),
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

  it('shows the previously submitted free-text answer below the text box', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
        myAnswers: { r1q1: 'Banana' },
      }),
    );
    render(<PlayPage />);

    expect(screen.getByText('Submitted: Banana')).toBeInTheDocument();
  });

  it('does not show a submitted-answer note before the team has answered', () => {
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

    expect(screen.queryByText(/submitted:/i)).not.toBeInTheDocument();
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
});
