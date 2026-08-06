import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from '@/app/register/page';
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

describe('RegisterPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
  });

  it('shows a loading state while auth is checking', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'checking' }));
    render(<RegisterPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('redirects to /sessions once already authenticated', async () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated' }));
    render(<RegisterPage />);

    await waitFor(() => expect(routerRef.replace).toHaveBeenCalledWith('/sessions'));
  });

  it('renders the register form when unauthenticated', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated' }));
    render(<RegisterPage />);

    expect(screen.getByRole('button', { name: /^register$/i })).toBeInTheDocument();
  });

  it('shows a validation error and skips the API call when the passwords do not match', async () => {
    const register = vi.fn();
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated', register }));
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different');
    await userEvent.click(screen.getByRole('button', { name: /^register$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(register).not.toHaveBeenCalled();
  });

  it('submits matching passwords to auth.register', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authResult({ status: 'unauthenticated', register }));
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: /^register$/i }));

    expect(register).toHaveBeenCalledWith('alice', 'hunter2');
  });

  it('shows the pending-approval view once registration succeeds', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'pending' }));
    render(<RegisterPage />);

    expect(screen.getByText(/awaiting admin approval/i)).toBeInTheDocument();
  });
});
