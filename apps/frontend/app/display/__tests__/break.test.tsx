import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { progress } from './test-utils';

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

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg role="img" aria-label={title} data-testid="qr-code" data-value={value} />
  ),
}));

describe('DisplayPage — break', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
  });

  it('shows a "BREAK" title card once a round locks, with no block questions to review', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'break_intro', roundIndex: 1 }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
  });

  it('keeps showing the same "BREAK" title card for the whole grading break, even once block questions exist', () => {
    // Grading happens off-screen in the admin panel; the display stays on
    // the plain BREAK card throughout — the block's questions/answers only
    // appear later, during the reveal_intro/reveal walk.
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break', roundIndex: 1, revealIndex: 1 }),
        currentQuestion: null,
        blockQuestions: [
          {
            id: 23,
            type: 'picture',
            prompt: 'Which landmark?',
            mediaUrl: 'https://example.com/landmark.jpg',
            points: 3,
            roundNumber: 2,
            questionNumberInRound: 1,
            roundTitle: 'World Landmarks',
          },
          {
            id: 24,
            type: 'free_text',
            prompt: 'Name this flag.',
            points: 3,
            roundNumber: 2,
            questionNumberInRound: 2,
            roundTitle: 'World Landmarks',
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.queryByText('Name this flag.')).not.toBeInTheDocument();
    expect(screen.queryByText('Which landmark?')).not.toBeInTheDocument();
  });
});
