import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';
import type { UseAuthResult } from '@/app/lib/use-auth';

const { mockUseAuth, routerRef } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerRef,
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

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
  });

  it('shows a loading state while auth is checking', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'checking' }));
    render(<LoginPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('redirects to /sessions once already authenticated', async () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated' }));
    render(<LoginPage />);

    await waitFor(() => expect(routerRef.replace).toHaveBeenCalledWith('/sessions'));
  });

  it('renders the login form when unauthenticated', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated' }));
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('submits the entered credentials to auth.login', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated', login }));
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(login).toHaveBeenCalledWith('alice', 'hunter2');
  });

  it('shows the auth error returned by useAuth', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated', error: 'Invalid username or password' }));
    render(<LoginPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password');
  });
});
