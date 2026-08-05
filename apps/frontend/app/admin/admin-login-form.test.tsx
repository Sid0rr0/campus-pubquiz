import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminLoginForm } from '@/app/admin/admin-login-form';

function renderForm(overrides: Partial<React.ComponentProps<typeof AdminLoginForm>> = {}) {
  const props = {
    usernameInput: '',
    passwordInput: '',
    onUsernameInputChange: vi.fn(),
    onPasswordInputChange: vi.fn(),
    onSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    onSwitchToRegister: vi.fn(),
    ...overrides,
  };
  render(<AdminLoginForm {...props} />);
  return props;
}

describe('AdminLoginForm', () => {
  it('renders an error message when provided', () => {
    renderForm({ error: 'Invalid username or password' });

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password');
  });

  it('calls onSubmit when the form is submitted', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('calls onSwitchToRegister when the register link is clicked', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(props.onSwitchToRegister).toHaveBeenCalled();
  });
});
