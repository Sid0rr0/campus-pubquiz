import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionsPage from '@/app/sessions/page';
import type { UseAuthResult } from '@/app/lib/use-auth';

const { mockUseAuth, routerRef } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerRef,
}));

vi.mock('@/app/sessions/session-picker-panel', () => ({
  SessionPickerPanel: ({ onOpenSession }: { onOpenSession: (joinCode: string) => void }) => (
    <button type="button" onClick={() => onOpenSession('NEWCODE')}>
      Open new session
    </button>
  ),
}));

function authResult(overrides: Partial<UseAuthResult> = {}): UseAuthResult {
  return {
    user: null,
    status: 'checking',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe('SessionsPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
  });

  it('shows a loading state while auth is checking', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'checking' }));
    render(<SessionsPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('redirects to /login when unauthenticated', async () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated' }));
    render(<SessionsPage />);

    await waitFor(() => expect(routerRef.replace).toHaveBeenCalledWith('/login'));
  });

  it('redirects to /login when the account is pending approval', async () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'pending' }));
    render(<SessionsPage />);

    await waitFor(() => expect(routerRef.replace).toHaveBeenCalledWith('/login'));
  });

  it('renders the session picker once authenticated', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated' }));
    render(<SessionsPage />);

    expect(screen.getByRole('button', { name: /open new session/i })).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('navigates to the chosen session when opened from the picker', async () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated' }));
    render(<SessionsPage />);

    await userEvent.click(screen.getByRole('button', { name: /open new session/i }));

    expect(routerRef.push).toHaveBeenCalledWith('/admin?code=NEWCODE');
  });
});
