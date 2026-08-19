import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { authenticatedAuthResult, progress } from './test-utils';

const { mockUseGameSocket, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseGameSocket: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

describe('AdminPage — session routing', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
    });
  });

  it('redirects to /sessions when no ?code= is in the URL', async () => {
    render(<AdminPage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('redirects to /sessions when the session code is invalid (never got a snapshot)', async () => {
    searchParamsRef.current = new URLSearchParams('code=BADCODE');
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: 'Unknown game session code',
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('does not redirect to /sessions when an action is rejected on an otherwise-connected session', async () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      },
      connectionError:
        'Cannot reveal yet: 1 question(s) still have ungraded answers.',
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(
      await screen.findByText(
        'Cannot reveal yet: 1 question(s) still have ungraded answers.',
      ),
    ).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalledWith('/sessions');
  });

  it('does not connect the socket until a session code is known', () => {
    render(<AdminPage />);

    expect(mockUseGameSocket).toHaveBeenLastCalledWith(
      'admin',
      false,
      undefined,
    );
  });

  it('connects the socket for the session code once present in the URL', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<AdminPage />);

    expect(mockUseGameSocket).toHaveBeenLastCalledWith('admin', true, 'ABCDEF');
  });

  it('syncs the URL when the snapshot reports a different session (e.g. after selecting a new quiz)', async () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'GHIJKL',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/admin?code=GHIJKL'),
    );
  });

  it('does not sync the URL when the snapshot already matches the session code', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('renders a switch-session link and an open-display link scoped to the current session', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<AdminPage />);

    const [displayLink] = screen.getAllByRole('link', {
      name: /open display/i,
    });
    expect(displayLink).toHaveAttribute('href', '/display?code=ABCDEF');
    const [switchLink] = screen.getAllByRole('link', {
      name: /switch session/i,
    });
    expect(switchLink).toHaveAttribute('href', '/sessions');
  });
});
