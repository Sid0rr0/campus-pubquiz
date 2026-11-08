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

const whoAmI = {
  questions: [
    {
      type: 'clues' as const,
      prompt: 'Who am I?',
      options: ['Vague', 'Sharper', 'Giveaway'],
      points: 1.5,
      answer: 'Einstein',
    },
  ],
};

describe('DisplayPage — a Clue question', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('lists the clues shown so far while it is asked', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [whoAmI],
        progress: { status: 'question_open' },
        clueStep: 1,
        highestClueShown: { 1: 2 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Who am I?')).toBeInTheDocument();
    expect(screen.getByText('Vague')).toBeInTheDocument();
    expect(screen.getByText('Sharper')).toBeInTheDocument();
    expect(screen.queryByText('Giveaway')).not.toBeInTheDocument();
  });

  it('shows the answer and every clue at the reveal', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [whoAmI],
        progress: { status: 'reveal', revealIndex: 0 },
        highestClueShown: { 1: 1 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Giveaway')).toBeInTheDocument();
    expect(screen.getByText('Vague')).toBeInTheDocument();
    expect(screen.getAllByText('Einstein').length).toBeGreaterThan(0);
  });
});
