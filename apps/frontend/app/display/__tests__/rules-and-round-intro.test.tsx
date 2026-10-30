import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { RulesContent } from '@/app/components/rules-content';
import { DEFAULT_SESSION_SETTINGS, SOCKET_ROOMS } from '@campus-pubquiz/types';
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

  it.each([
    [
      true,
      2,
      'Power-ups are on: you start with 2 coins. Earn more with shots, selfies and coins from the quiz master.',
    ],
    [
      true,
      1,
      'Power-ups are on: you start with 1 coin. Earn more with shots, selfies and coins from the quiz master.',
    ],
    [false, 2, null],
  ])(
    'with power-ups %s and %s starting coins the rules screen shows %s',
    (powerUpsEnabled, startingCoins, line) => {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          settings: { powerUpsEnabled, startingCoins },
          progress: { status: 'rules' },
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
      render(<DisplayPage />);

      expect(screen.queryByText(/power-ups are on/i)?.textContent ?? null).toBe(
        line,
      );
    },
  );

  it.each([
    [false, true],
    [false, false],
    [true, true],
  ])(
    'with power-ups %s and a carried coin %s the rules hint about the coin is shown only with power-ups off and a coin',
    (powerUpsEnabled, hasCarriedCoin) => {
      render(
        <RulesContent
          settings={{ ...DEFAULT_SESSION_SETTINGS, powerUpsEnabled }}
          hasCarriedCoin={hasCarriedCoin}
        />,
      );

      expect(screen.queryByText(/for rating every round/i) !== null).toBe(
        !powerUpsEnabled && hasCarriedCoin,
      );
    },
  );

  it.each([
    [true, true],
    [false, false],
  ])(
    'with Jokers %s the rules screen shows the joker line: %s',
    (jokersEnabled, isShown) => {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          settings: { jokersEnabled, showRoundOverview: true },
          progress: { status: 'rules' },
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
      render(<DisplayPage />);

      const line = screen.queryByText(
        "Joker: pick one round to score double. You'll choose after the round overview.",
      );
      expect(line !== null).toBe(isShown);
    },
  );

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

  describe('round note on the round title card', () => {
    function renderRoundIntro(round: {
      note?: string;
      showNoteOnScreen?: boolean;
    }) {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          rounds: [{ title: 'Picture Round', ...round }],
          progress: { status: 'round_intro', roundIndex: 0 },
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
      render(<DisplayPage />);
    }

    it('draws the note, line breaks kept, when the view carries it', () => {
      renderRoundIntro({
        note: 'Answers in English\nNo phones',
        showNoteOnScreen: true,
      });

      const note = screen.getByText(/Answers in English/);
      expect(note).toHaveTextContent('Answers in English No phones');
      expect(note).toHaveClass('whitespace-pre-line');
    });

    it('draws nothing extra when the setting is off', () => {
      renderRoundIntro({ note: 'Answers in English' });

      expect(screen.queryByText(/Answers in English/)).not.toBeInTheDocument();
    });
  });
});
