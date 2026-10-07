import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg
      role="img"
      aria-label={title}
      data-testid="qr-code"
      data-value={value}
    />
  ),
}));

const WORLD_LANDMARKS = {
  title: 'World Landmarks',
  questions: [
    {
      id: 23,
      prompt: 'Which landmark?',
      mediaUrl: 'https://example.com/landmark.jpg',
      points: 3,
    },
    { id: 24, prompt: 'Name this flag.', points: 3 },
  ],
};

// Round 2 is the first break: round 1 flows into it, so "BREAK 1" follows round 2.
const breakAfterRoundTwoQuiz = [
  { breakAfter: false, questions: [{}] },
  WORLD_LANDMARKS,
];

// Both rounds break, so round 2's two questions are a block of their own.
const roundTwoBlockQuiz = [{ questions: [{}] }, WORLD_LANDMARKS];

describe('DisplayPage — break', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows a "BREAK" title card once a round locks (break_intro)', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: breakAfterRoundTwoQuiz,
        progress: { status: 'break_intro', roundIndex: 1, questionIndex: 1 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
  });

  it('keeps showing the generic BREAK card for break_intro even once block questions have loaded, never showing Q5 itself', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: breakAfterRoundTwoQuiz,
        progress: {
          status: 'break_intro',
          roundIndex: 1,
          questionIndex: 1,
          revealIndex: 1,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
    expect(screen.queryByText('Name this flag.')).not.toBeInTheDocument();
  });

  it("shows the block's last question (no answer) immediately once break proper is entered (Previous from break_intro), without skipping it", () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: roundTwoBlockQuiz,
        // revealIndex 1 is the last index of a 2-question block: the one
        // that just locked — it must show its own content, not a generic
        // card, so Previous steps to the second-to-last question next.
        progress: {
          status: 'break',
          roundIndex: 1,
          questionIndex: 1,
          revealIndex: 1,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Name this flag.')).toBeInTheDocument();
    expect(screen.queryByText('BREAK')).not.toBeInTheDocument();
  });

  it("shows the specific question (no answer) once Previous walks revealIndex off the entry position, matching question_open's layout", () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: roundTwoBlockQuiz,
        progress: {
          status: 'break',
          roundIndex: 1,
          questionIndex: 1,
          revealIndex: 0,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Which landmark?')).toBeInTheDocument();
    expect(screen.queryByText('Name this flag.')).not.toBeInTheDocument();
    expect(screen.queryByText('BREAK')).not.toBeInTheDocument();
    expect(screen.queryByText(/answer/i)).not.toBeInTheDocument();
  });

  it("shows the round's own title card once Previous crosses a round boundary during break review", () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: roundTwoBlockQuiz,
        progress: {
          status: 'break_round_intro',
          roundIndex: 1,
          questionIndex: 1,
          revealIndex: 0,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('World Landmarks')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.queryByText('Which landmark?')).not.toBeInTheDocument();
    expect(screen.queryByText('BREAK')).not.toBeInTheDocument();
  });
});
