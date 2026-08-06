import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';

const { mockUseGameSocket, searchParamsRef, routerRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

vi.mock('@/app/display/display-session-picker', () => ({
  DisplaySessionPicker: ({
    onSelectSession,
    connectionError,
  }: {
    onSelectSession: (joinCode: string) => void;
    connectionError?: string | null;
  }) => (
    <div>
      {connectionError && <p role="alert">{connectionError}</p>}
      <button type="button" onClick={() => onSelectSession('NEWCODE')}>
        Pick session
      </button>
    </div>
  ),
}));

describe('DisplayPage — session picker routing', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReset();
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
  });

  it('shows the session picker when no ?code= is in the URL', async () => {
    render(<DisplayPage />);

    expect(await screen.findByRole('button', { name: /pick session/i })).toBeInTheDocument();
  });

  it('does not connect the socket until a session code is known', () => {
    render(<DisplayPage />);

    expect(mockUseGameSocket).toHaveBeenLastCalledWith('display', false, undefined);
  });

  it('replaces the URL with the chosen session when picked', async () => {
    render(<DisplayPage />);

    await userEvent.click(await screen.findByRole('button', { name: /pick session/i }));

    expect(routerRef.replace).toHaveBeenCalledWith('/display?code=NEWCODE');
  });

  it('connects the socket for the session code once present in the URL', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<DisplayPage />);

    expect(mockUseGameSocket).toHaveBeenLastCalledWith('display', true, 'ABCDEF');
  });

  it('falls back to the picker with the connection error when the code is unknown or stale', async () => {
    searchParamsRef.current = new URLSearchParams('code=STALE1');
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: 'Unknown game session code',
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/unknown game session code/i);
  });
});
