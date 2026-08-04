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

  it('shows a plain grading message during a break with no block questions to review', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'break' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/grading/i)).toBeInTheDocument();
  });

  it('shows the question under review during a break, without its answer', () => {
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

    expect(screen.getByText('Name this flag.')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.getByText(/break.*question 2/i)).toBeInTheDocument();
    expect(screen.queryByText('Which landmark?')).not.toBeInTheDocument();
    expect(screen.queryByText(/answer/i)).not.toBeInTheDocument();
    // The round's name isn't shown yet during break — only later, on the
    // reveal_intro card, before that round's answers appear.
    expect(screen.queryByText('World Landmarks')).not.toBeInTheDocument();
  });

  it('shows a "BREAK" title card before the grading-review view, once a round locks', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break_intro', roundIndex: 1 }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
  });
});
