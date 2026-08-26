import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
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

describe('PlayPage — question visibility', () => {
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
          currentQuestion: {
            id: 'r1q1',
            type: 'free_text',
            prompt: 'Name a fruit',
            points: 1,
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('keeps showing the question and answer form during the locking countdown', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'locking' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'free_text',
            prompt: 'Name a fruit',
            points: 1,
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

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
    renderWithQuery(<PlayPage />);

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
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('does not show the screen hint for a free-text question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: {
            id: 'r1q1',
            type: 'free_text',
            prompt: 'Name a fruit',
            points: 1,
          },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText(/look at the screen/i)).not.toBeInTheDocument();
  });
});
