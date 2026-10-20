import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { SOCKET_ROOMS, type LeagueTop } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';
import { displaySounds } from '@/app/lib/display-sounds';

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

describe('DisplayPage — lobby', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows a connecting message before the first snapshot arrives', () => {
    mockUseGame.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('passes the ?code= query parameter to the socket handshake', () => {
    searchParamsRef.current = new URLSearchParams('code=GHIJKL');
    mockUseGame.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(mockUseGame).toHaveBeenCalledWith(true, 'GHIJKL');
  });

  it('shows a waiting message in the lobby', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });

  it('shows a join QR code and the join code in the lobby', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('qr-code')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/play?code=ABCDEF`,
    );
    expect(screen.getByText('ABCDEF')).toBeInTheDocument();
  });

  it('shows the max team size, one-device-per-team note, and extra-player penalty in the lobby', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(
      screen.getByText(
        'Make teams of up to 6 players, only one device connects per team. Every additional player costs the team −2 points.',
      ),
    ).toBeInTheDocument();
  });

  it('prefers the join code from the ?code= query parameter over the snapshot', () => {
    searchParamsRef.current = new URLSearchParams('code=GHIJKL');
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('qr-code')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/play?code=GHIJKL`,
    );
    expect(screen.getByText('GHIJKL')).toBeInTheDocument();
  });

  it('shows the connected team names at the bottom of the lobby screen with a join count', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('The Quizzards')).toBeInTheDocument();
    expect(screen.getByText('Beer Necessities')).toBeInTheDocument();
    expect(screen.getByText('2 TEAMS JOINED')).toBeInTheDocument();
  });

  it('scrolls the team names as a looping marquee when they overflow the screen width', () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(2000);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(1000);
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });

    render(<DisplayPage />);

    const copies = screen.getAllByText('The Quizzards');
    expect(copies).toHaveLength(2);
    expect(copies[1].closest('[aria-hidden="true"]')).not.toBeNull();
    expect(copies[0].closest('.animate-marquee')).not.toBeNull();
    scrollWidthSpy.mockRestore();
    clientWidthSpy.mockRestore();
  });

  it('uses the singular "TEAM" when exactly one team has joined', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('1 TEAM JOINED')).toBeInTheDocument();
  });

  describe('league top five', () => {
    const row = (position: number, teamName: string, leaguePoints: number) => ({
      teamId: position,
      teamName,
      leaguePoints,
      nightsPlayed: 3,
      nightsWon: 1,
      averagePlacing: 2,
      position,
    });

    function lobbyWithLeague(leagueTop: LeagueTop | null) {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          progress: { status: 'lobby' },
          leagueTop,
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
      render(<DisplayPage />);
    }

    it('shows the league name and its top rows beside the join details', () => {
      lobbyWithLeague({
        name: 'Autumn 2026',
        rows: [row(1, 'Quizzards', 21), row(2, 'Beer Necessities', 17)],
      });

      const league = screen.getByRole('region', { name: 'Autumn 2026' });
      expect(within(league).getByText('Quizzards')).toBeInTheDocument();
      expect(within(league).getByText('21 pts')).toBeInTheDocument();
      expect(within(league).getByText('Beer Necessities')).toBeInTheDocument();
      expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    });

    it('shows tied teams at the same position', () => {
      lobbyWithLeague({
        name: 'Autumn 2026',
        rows: [row(1, 'Alpha', 9), row(1, 'Beta', 9), row(3, 'Gamma', 4)],
      });

      const league = screen.getByRole('region', { name: 'Autumn 2026' });
      expect(
        within(within(league).getByText('Beta').closest('li')!).getByText('1'),
      ).toBeInTheDocument();
      expect(
        within(within(league).getByText('Gamma').closest('li')!).getByText('3'),
      ).toBeInTheDocument();
    });

    it('says nobody has scored yet for a league with no rows', () => {
      lobbyWithLeague({ name: 'Autumn 2026', rows: [] });

      expect(
        within(screen.getByRole('region', { name: 'Autumn 2026' })).getByText(
          /no points yet/i,
        ),
      ).toBeInTheDocument();
    });

    it('shows nothing when the session is in no league', () => {
      lobbyWithLeague(null);

      expect(screen.queryByRole('region')).not.toBeInTheDocument();
      expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
    });
  });

  describe('join chime', () => {
    const lobbyWith = (teams: { teamId: number; teamName: string }[]) => ({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'lobby' },
        teams,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });

    it('does not chime for teams present at the first snapshot', () => {
      const playSpy = vi.spyOn(displaySounds, 'play');
      mockUseGame.mockReturnValue(
        lobbyWith([{ teamId: 1, teamName: 'The Quizzards' }]),
      );

      render(<DisplayPage />);

      expect(playSpy).not.toHaveBeenCalledWith('chime');
      playSpy.mockRestore();
    });

    it('chimes once when teams join after the first snapshot', () => {
      const playSpy = vi.spyOn(displaySounds, 'play');
      mockUseGame.mockReturnValue(
        lobbyWith([{ teamId: 1, teamName: 'The Quizzards' }]),
      );
      const { rerender } = render(<DisplayPage />);

      mockUseGame.mockReturnValue(
        lobbyWith([
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
          { teamId: 3, teamName: 'Pub Crawlers' },
        ]),
      );
      rerender(<DisplayPage />);

      expect(
        playSpy.mock.calls.filter(([name]) => name === 'chime'),
      ).toHaveLength(1);
      playSpy.mockRestore();
    });
  });

  it('does not show the connected team names outside the lobby', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'question_open' },
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
  });

  it('does not show the join QR code outside the lobby', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });
});
