import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseAuthResult } from '@/app/lib/use-auth';
import { StaffGate } from '@/app/components/staff-gate';

const { mockUseAuth, routerRef } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  routerRef: { replace: vi.fn() },
}));

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));
vi.mock('next/navigation', () => ({ useRouter: () => routerRef }));

function signedInAs(role: 'admin' | 'moderator'): Partial<UseAuthResult> {
  return {
    status: 'authenticated',
    user: { id: 1, username: 'staff', role, status: 'active' },
  };
}

function renderGate(auth: Partial<UseAuthResult>, adminOnly?: boolean) {
  mockUseAuth.mockReturnValue({ user: null, ...auth });
  render(
    <StaffGate adminOnly={adminOnly}>
      <p>Panel</p>
    </StaffGate>,
  );
}

describe('StaffGate', () => {
  beforeEach(() => routerRef.replace.mockReset());

  it('shows the loading screen and stays put while the session is checked', () => {
    renderGate({ status: 'checking' });

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Panel')).not.toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it.each(['unauthenticated', 'pending'] as const)(
    'sends a %s visitor to /login',
    (status) => {
      renderGate({ status });

      expect(routerRef.replace).toHaveBeenCalledWith('/login');
      expect(screen.queryByText('Panel')).not.toBeInTheDocument();
    },
  );

  it('shows a staff page to a moderator', () => {
    renderGate(signedInAs('moderator'));

    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('sends a moderator on an admin-only page to /control', () => {
    renderGate(signedInAs('moderator'), true);

    expect(routerRef.replace).toHaveBeenCalledWith('/control');
    expect(screen.queryByText('Panel')).not.toBeInTheDocument();
  });

  it('shows an admin-only page to an admin', () => {
    renderGate(signedInAs('admin'), true);

    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalled();
  });
});
