import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PendingApprovalView } from '@/app/admin/pending-approval-view';

describe('PendingApprovalView', () => {
  it('shows the pending-approval message', () => {
    render(<PendingApprovalView onLogout={vi.fn()} />);

    expect(screen.getByText(/awaiting admin approval/i)).toBeInTheDocument();
  });

  it('calls onLogout when the back-to-login button is clicked', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<PendingApprovalView onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: /back to login/i }));

    expect(onLogout).toHaveBeenCalled();
  });
});
