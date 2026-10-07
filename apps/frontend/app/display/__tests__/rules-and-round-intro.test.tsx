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

describe('DisplayPage — rules and round intro', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the rules screen after the lobby, before the first question opens', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        // Six rounds of four questions, with a break after rounds 3 and 6.
        rounds: Array.from({ length: 6 }, (_, index) => ({
          breakAfter: index % 3 === 2,
          questions: [{}, {}, {}, {}],
        })),
        progress: { status: 'rules' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(
      screen.getByText(
        /6 topics, 4 questions each, with a break after every 3 rounds/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('lists every round title, category, and author on the round overview screen, before round 0 opens', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          { title: 'General Knowledge', category: 'General knowledge' },
          { title: 'Picture Round', author: 'Sam' },
          { title: 'Music Round' },
        ],
        progress: { status: 'round_overview' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('General Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Picture Round')).toBeInTheDocument();
    expect(screen.getByText('Music Round')).toBeInTheDocument();
    expect(screen.getByText(/General knowledge/)).toBeInTheDocument();
    expect(screen.getByText(/by Sam/)).toBeInTheDocument();
  });

  it('shows the round name, category, and author on the round intro screen, before any question opens', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          { title: 'General Knowledge' },
          { title: 'Picture Round', category: 'Film & TV', author: 'Sam' },
        ],
        progress: { status: 'round_intro', roundIndex: 1 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Picture Round')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Film & TV/)).toBeInTheDocument();
    expect(screen.getByText(/by Sam/)).toBeInTheDocument();
  });
});
