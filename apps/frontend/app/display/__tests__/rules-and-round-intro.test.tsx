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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg role="img" aria-label={title} data-testid="qr-code" data-value={value} />
  ),
}));

describe('DisplayPage — rules and round intro', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the rules screen after the lobby, before the first question opens', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'rules' }),
        currentQuestion: null,
        quizStructure: { blockCount: 2, topicsPerBlock: 3 },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText(/2 rounds of 3 topics/i)).toBeInTheDocument();
    expect(screen.getByText(/no cheating/i)).toBeInTheDocument();
  });

  it('shows the round name in big text on the round intro screen, before any question opens', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'round_intro', roundIndex: 1 }),
        currentQuestion: null,
        roundTitle: 'Picture Round',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Picture Round')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
  });
});
