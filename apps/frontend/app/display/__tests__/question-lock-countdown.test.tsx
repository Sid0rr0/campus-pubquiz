import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const capitalOfFrance = {
  type: 'multiple_choice' as const,
  prompt: 'Capital of France?',
  options: ['Paris', 'London'],
  points: 2,
};

describe('DisplayPage — question lock countdown', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no countdown while the question itself is open', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [capitalOfFrance] }],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(
      screen.queryByTestId('question-lock-countdown'),
    ).not.toBeInTheDocument();
  });

  it('shows a countdown ring while a kahoot question is open with a timer armed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ kahootMode: true, questions: [capitalOfFrance] }],
        progress: { status: 'question_open' },
        timers: { kahootQuestionEndsAt: Date.now() + 20_000 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('question-lock-countdown')).toHaveTextContent(
      '20',
    );
  });

  it('hides the question and shows the seconds remaining once locking starts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [capitalOfFrance] }],
        progress: { status: 'locking' },
        timers: { questionLockAt: Date.now() + 45_000 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('question-lock-countdown')).toHaveTextContent(
      '45',
    );
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it('counts down as time passes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [capitalOfFrance] }],
        progress: { status: 'locking' },
        timers: { questionLockAt: Date.now() + 10_000 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByTestId('question-lock-countdown')).toHaveTextContent(
      '7',
    );
  });
});
