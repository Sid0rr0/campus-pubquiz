import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import { SiteHeader } from '@/app/components/site-header';

const { mockUseAuth, mockPush, pathnameRef } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockPush: vi.fn(),
  pathnameRef: { current: '/sessions' },
}));

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push: mockPush }),
}));

const ADMIN_USER: AuthUser = { id: 1, username: 'quizmaster', role: 'admin', status: 'active' };
const MODERATOR_USER: AuthUser = { id: 2, username: 'helper', role: 'moderator', status: 'active' };

function authResult(overrides: Partial<UseAuthResult> = {}): UseAuthResult {
  return {
    user: null,
    status: 'unauthenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe('SiteHeader', () => {
  beforeEach(() => {
    pathnameRef.current = '/sessions';
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authResult());
    mockPush.mockReset();
  });

  it('always shows the brand link back to home', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /trivia night/i })).toHaveAttribute('href', '/');
  });

  it('shows Log in and Register links when unauthenticated', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register');
  });

  it('shows the username and a Log out button when authenticated', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated', user: MODERATOR_USER }));
    render(<SiteHeader />);

    expect(screen.getByText('helper')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^users$/i })).not.toBeInTheDocument();
  });

  it('shows a Users link only for admin users', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated', user: ADMIN_USER }));
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /^users$/i })).toHaveAttribute('href', '/admin/users');
  });

  it('calls auth.logout and redirects home when the Log out button is clicked', async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated', user: ADMIN_USER, logout }));
    render(<SiteHeader />);

    await userEvent.setup().click(screen.getByRole('button', { name: /log out/i }));

    expect(logout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows neither auth links nor account controls while checking auth status', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'checking' }));
    render(<SiteHeader />);

    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('shows only the logo, with no nav links, on the home page', () => {
    pathnameRef.current = '/';
    mockUseAuth.mockReturnValue(authResult({ status: 'authenticated', user: ADMIN_USER }));
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /trivia night/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders nothing on /display — the audience screen owns its own header', () => {
    pathnameRef.current = '/display';
    const { container } = render(<SiteHeader />);

    expect(container).toBeEmptyDOMElement();
    expect(mockUseAuth).not.toHaveBeenCalled();
  });
});
