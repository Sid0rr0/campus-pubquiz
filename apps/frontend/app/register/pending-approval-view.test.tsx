import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PendingApprovalView } from '@/app/register/pending-approval-view';

describe('PendingApprovalView', () => {
  it('shows the pending-approval message', () => {
    render(<PendingApprovalView />);

    expect(screen.getByText(/awaiting admin approval/i)).toBeInTheDocument();
  });

  it('links back to the login page', () => {
    render(<PendingApprovalView />);

    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login');
  });
});
