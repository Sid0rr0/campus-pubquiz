import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersPanel } from '@/app/admin/users/users-panel';

const { mockFetchUsers, mockApproveUser, mockDeactivateUser } = vi.hoisted(
  () => ({
    mockFetchUsers: vi.fn(),
    mockApproveUser: vi.fn(),
    mockDeactivateUser: vi.fn(),
  }),
);

vi.mock('@/app/lib/auth-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/auth-api')>();
  return {
    ...actual,
    fetchUsers: mockFetchUsers,
    approveUser: mockApproveUser,
    deactivateUser: mockDeactivateUser,
  };
});

const PAYLOAD = {
  pending: [
    {
      id: 5,
      username: 'bob',
      role: 'moderator' as const,
      status: 'pending' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  active: [
    {
      id: 1,
      username: 'alice',
      role: 'admin' as const,
      status: 'active' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  deactivated: [],
};

describe('UsersPanel', () => {
  beforeEach(() => {
    mockFetchUsers.mockReset();
    mockApproveUser.mockReset();
    mockDeactivateUser.mockReset();
    mockFetchUsers.mockResolvedValue(PAYLOAD);
  });

  it('lists pending and active users once loaded', async () => {
    render(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('approves a pending user with the selected role', async () => {
    const user = userEvent.setup();
    mockApproveUser.mockResolvedValue(undefined);
    render(<UsersPanel />);
    await waitFor(() => screen.getByText('bob'));

    await user.selectOptions(screen.getByLabelText(/role for bob/i), 'admin');
    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() =>
      expect(mockApproveUser).toHaveBeenCalledWith(5, 'admin'),
    );
    expect(mockFetchUsers).toHaveBeenCalledTimes(2);
  });

  it('deactivates an active user', async () => {
    const user = userEvent.setup();
    mockDeactivateUser.mockResolvedValue(undefined);
    render(<UsersPanel />);
    await waitFor(() => screen.getByText('alice'));

    await user.click(screen.getByRole('button', { name: /deactivate/i }));

    await waitFor(() => expect(mockDeactivateUser).toHaveBeenCalledWith(1));
  });

  it('shows an error alert when the initial fetch fails', async () => {
    mockFetchUsers.mockReset();
    mockFetchUsers.mockRejectedValue(new Error('Could not load users'));
    render(<UsersPanel />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not load users',
      ),
    );
  });
});
