import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import type { PlayerMenuState } from '@/app/lib/player-menu-context';
import { SiteHeader } from '@/app/components/site-header';

const { mockUseAuth, mockUsePlayerMenu, mockPush, pathnameRef } = vi.hoisted(
  () => ({
    mockUseAuth: vi.fn(),
    mockUsePlayerMenu: vi.fn(),
    mockPush: vi.fn(),
    pathnameRef: { current: '/sessions' },
  }),
);

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));
vi.mock('@/app/lib/player-menu-context', () => ({
  usePlayerMenu: mockUsePlayerMenu,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push: mockPush }),
}));

const ADMIN_USER: AuthUser = {
  id: 1,
  username: 'quizmaster',
  role: 'admin',
  status: 'active',
};
const MODERATOR_USER: AuthUser = {
  id: 2,
  username: 'helper',
  role: 'moderator',
  status: 'active',
};

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

function playerMenu(overrides: Partial<PlayerMenuState> = {}): PlayerMenuState {
  return {
    teamName: 'The Quizzards',
    team: null,
    onLogOut: vi.fn(),
    ...overrides,
  };
}

describe('SiteHeader', () => {
  beforeEach(() => {
    pathnameRef.current = '/sessions';
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authResult());
    mockUsePlayerMenu.mockReset();
    mockUsePlayerMenu.mockReturnValue(null);
    mockPush.mockReset();
  });

  it('always shows the brand link back to home', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: /campus pub quiz/i }),
    ).toHaveAttribute('href', '/');
  });

  it('shows no nav links when unauthenticated', () => {
    render(<SiteHeader />);

    expect(
      screen.queryByRole('link', { name: /log in/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /log out/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the username and a Log out button when authenticated', () => {
    mockUseAuth.mockReturnValue(
      authResult({ status: 'authenticated', user: MODERATOR_USER }),
    );
    render(<SiteHeader />);

    expect(screen.getByText('helper')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /log out/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^users$/i }),
    ).not.toBeInTheDocument();
  });

  it('shows a Users link only for admin users', () => {
    mockUseAuth.mockReturnValue(
      authResult({ status: 'authenticated', user: ADMIN_USER }),
    );
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /^users$/i })).toHaveAttribute(
      'href',
      '/admin/users',
    );
  });

  it('calls auth.logout and redirects home when the Log out button is clicked', async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue(
      authResult({ status: 'authenticated', user: ADMIN_USER, logout }),
    );
    render(<SiteHeader />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /log out/i }));

    expect(logout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows neither auth links nor account controls while checking auth status', () => {
    mockUseAuth.mockReturnValue(authResult({ status: 'checking' }));
    render(<SiteHeader />);

    expect(
      screen.queryByRole('link', { name: /log in/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /log out/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the same nav links on the home page as elsewhere', () => {
    pathnameRef.current = '/';
    mockUseAuth.mockReturnValue(
      authResult({ status: 'authenticated', user: ADMIN_USER }),
    );
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: /campus pub quiz/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it('renders nothing on /display — the audience screen owns its own header', () => {
    pathnameRef.current = '/display';
    const { container } = render(<SiteHeader />);

    expect(container).toBeEmptyDOMElement();
    expect(mockUseAuth).not.toHaveBeenCalled();
  });

  it('shows no mobile hamburger when neither an account nor a team is present', () => {
    render(<SiteHeader />);

    expect(
      screen.queryByRole('button', { name: /open menu/i }),
    ).not.toBeInTheDocument();
  });

  it('reveals the admin account links from the mobile hamburger in the app header', async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue(
      authResult({ status: 'authenticated', user: ADMIN_USER, logout }),
    );
    render(<SiteHeader />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /open menu/i }));
    const drawer = screen.getByRole('dialog');

    expect(
      within(drawer).getByRole('link', { name: /^users$/i }),
    ).toBeInTheDocument();

    await userEvent
      .setup()
      .click(within(drawer).getByRole('button', { name: /log out/i }));

    expect(logout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows the team code and a working Log out button from the mobile hamburger on /play', async () => {
    pathnameRef.current = '/play';
    const onLogOut = vi.fn();
    mockUsePlayerMenu.mockReturnValue(
      playerMenu({
        team: {
          teamId: 1,
          teamToken: 'token-1',
          teamCode: 'QUICK-JADE-FOX',
          teamName: 'The Quizzards',
          answers: [],
          bonusAwards: [],
        },
        onLogOut,
      }),
    );
    render(<SiteHeader />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /open menu/i }));
    const drawer = screen.getByRole('dialog');

    expect(within(drawer).getByText(/QUICK-JADE-FOX/)).toBeInTheDocument();

    await userEvent
      .setup()
      .click(within(drawer).getByRole('button', { name: /log out/i }));

    expect(onLogOut).toHaveBeenCalled();
  });
});
