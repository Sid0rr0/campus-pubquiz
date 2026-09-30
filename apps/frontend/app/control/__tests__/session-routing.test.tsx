import { screen, waitFor } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/control/page';
import { authenticatedAuthResult, progress, adminView } from './test-utils';

const { mockUseAdminGame, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-admin-game', async () => {
  const { adminGameResult } =
    await import('@/app/control/__tests__/test-utils');
  return {
    useAdminGame: (...args: unknown[]) =>
      adminGameResult(mockUseAdminGame(...args)),
  };
});

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
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockUseAdminGame.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
    });
  });

  it('redirects to /sessions when no ?code= is in the URL', async () => {
    renderWithQuery(<AdminPage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('redirects to /sessions when the session code is invalid (never got a snapshot)', async () => {
    searchParamsRef.current = new URLSearchParams('code=BADCODE');
    mockUseAdminGame.mockReturnValue({
      snapshot: null,
      connectionError: 'Unknown game session code',
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });

  it('does not redirect to /sessions when an action is rejected on an otherwise-connected session', async () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'break' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      }),
      connectionError:
        'Cannot reveal yet: 1 question(s) still have ungraded answers.',
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(
      await screen.findByText(
        'Cannot reveal yet: 1 question(s) still have ungraded answers.',
      ),
    ).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalledWith('/sessions');
  });

  it('does not connect the socket until a session code is known', () => {
    renderWithQuery(<AdminPage />);

    expect(mockUseAdminGame).toHaveBeenLastCalledWith(false, undefined);
  });

  it('connects the socket for the session code once present in the URL', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    renderWithQuery(<AdminPage />);

    expect(mockUseAdminGame).toHaveBeenLastCalledWith(true, 'ABCDEF');
  });

  it('syncs the URL when the snapshot reports a different session (e.g. after selecting a new quiz)', async () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'GHIJKL',
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/control?code=GHIJKL'),
    );
  });

  it('does not sync the URL when the snapshot already matches the session code', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('renders an open-display link scoped to the current session', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseAdminGame.mockReturnValue({
      snapshot: adminView({
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    renderWithQuery(<AdminPage />);

    const [displayLink] = screen.getAllByRole('link', {
      name: /open display/i,
    });
    expect(displayLink).toHaveAttribute('href', '/display?code=ABCDEF');
  });
});
