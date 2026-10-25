import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';
import { DISPLAY_CODE_STORAGE_KEY } from '@/app/lib/display-code-storage';

const { mockUseGame, searchParamsRef, routerRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <svg role="img" />,
}));

vi.mock('@/app/display/display-session-picker', () => ({
  DisplaySessionPicker: () => <p>Pick a game to display</p>,
}));

const lobbySnapshot = () =>
  roomView(SOCKET_ROOMS.DISPLAY, { progress: { status: 'lobby' } });

function mockConnection(
  overrides: Partial<{
    snapshot: unknown;
    connectionError: string | null;
    connectionIssue: 'reconnecting' | 'refused' | null;
  }>,
) {
  mockUseGame.mockReturnValue({
    snapshot: null,
    connectionError: null,
    connectionIssue: null,
    ...overrides,
  });
}

describe('DisplayPage — reconnecting', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    routerRef.replace.mockReset();
    mockUseGame.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the last frame and shows a reconnecting badge while the socket retries', () => {
    mockConnection({
      snapshot: lobbySnapshot(),
      connectionError: 'Connection lost — reconnecting…',
      connectionIssue: 'reconnecting',
    });
    render(<DisplayPage />);

    expect(screen.getByText(/waiting for the teams/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/reconnecting/i);
    expect(screen.queryByText(/pick a game/i)).not.toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('shows no badge while connected', () => {
    mockConnection({ snapshot: lobbySnapshot() });
    render(<DisplayPage />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes back to the picker, clears the stored code and strips the URL when refused', () => {
    window.localStorage.setItem(DISPLAY_CODE_STORAGE_KEY, 'ABCDEF');
    mockConnection({
      connectionError: 'Unknown game session code',
      connectionIssue: 'refused',
    });
    render(<DisplayPage />);

    expect(screen.getByText(/pick a game/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(DISPLAY_CODE_STORAGE_KEY)).toBeNull();
    expect(routerRef.replace).toHaveBeenCalledWith('/display');
  });

  it('remembers the code it showed once a snapshot arrives', () => {
    mockConnection({ snapshot: lobbySnapshot() });
    render(<DisplayPage />);

    expect(window.localStorage.getItem(DISPLAY_CODE_STORAGE_KEY)).toBe(
      'ABCDEF',
    );
  });

  it('resumes the stored code when opened without ?code=', () => {
    window.localStorage.setItem(DISPLAY_CODE_STORAGE_KEY, 'STORED');
    searchParamsRef.current = new URLSearchParams();
    mockConnection({});
    render(<DisplayPage />);

    expect(routerRef.replace).toHaveBeenCalledWith('/display?code=STORED');
  });

  it('shows the picker when opened without ?code= and nothing is stored', () => {
    searchParamsRef.current = new URLSearchParams();
    mockConnection({});
    render(<DisplayPage />);

    expect(screen.getByText(/pick a game/i)).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('works with storage unavailable', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    mockConnection({ snapshot: lobbySnapshot() });

    render(<DisplayPage />);

    expect(screen.getByText(/waiting for the teams/i)).toBeInTheDocument();
  });

  it('lets the lobby go back to the picker with a "Pick another game" link', () => {
    window.localStorage.setItem(DISPLAY_CODE_STORAGE_KEY, 'ABCDEF');
    mockConnection({ snapshot: lobbySnapshot() });
    render(<DisplayPage />);

    fireEvent.click(screen.getByRole('button', { name: /pick another game/i }));

    expect(window.localStorage.getItem(DISPLAY_CODE_STORAGE_KEY)).toBeNull();
    expect(routerRef.replace).toHaveBeenCalledWith('/display');
  });
});
