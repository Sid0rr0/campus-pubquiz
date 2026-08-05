import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminRegisterForm } from '@/app/admin/admin-register-form';

function renderForm(overrides: Partial<React.ComponentProps<typeof AdminRegisterForm>> = {}) {
  const props = {
    usernameInput: '',
    passwordInput: '',
    confirmPasswordInput: '',
    onUsernameInputChange: vi.fn(),
    onPasswordInputChange: vi.fn(),
    onConfirmPasswordInputChange: vi.fn(),
    onSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    onSwitchToLogin: vi.fn(),
    ...overrides,
  };
  render(<AdminRegisterForm {...props} />);
  return props;
}

describe('AdminRegisterForm', () => {
  it('renders an error message when provided', () => {
    renderForm({ error: 'Username "alice" is already taken' });

    expect(screen.getByRole('alert')).toHaveTextContent('already taken');
  });

  it('calls onSubmit when the form is submitted', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: /^register$/i }));

    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('calls onSwitchToLogin when the login link is clicked', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(props.onSwitchToLogin).toHaveBeenCalled();
  });
});
