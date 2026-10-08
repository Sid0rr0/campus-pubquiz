import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
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

function showOverlayOverOpenQuestion() {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
      rounds: [{ questions: [{ prompt: 'Capital of France?' }] }],
      teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      progress: { status: 'question_open', isJoinOverlayVisible: true },
    }),
    connectionError: null,
    sendAction: vi.fn(),
  });
}

describe('DisplayPage — join overlay screen kind', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    showOverlayOverOpenQuestion();
  });

  it('draws the QR code pointing at /play with the join code', () => {
    render(<DisplayPage />);

    expect(screen.getByTestId('qr-code')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/play?code=ABCDEF`,
    );
  });

  it('shows the join code and the team-size and penalty line', () => {
    render(<DisplayPage />);

    expect(screen.getByText('ABCDEF')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Make teams of up to 6 players, only one device connects per team. Every additional player costs the team −2 points.',
      ),
    ).toBeInTheDocument();
  });

  it('covers the question underneath and shows no team roster', () => {
    render(<DisplayPage />);

    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
    expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
    expect(screen.queryByText(/teams? joined/i)).not.toBeInTheDocument();
  });
});
