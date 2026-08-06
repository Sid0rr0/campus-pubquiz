import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/app/login/login-form';

function renderForm(overrides: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  const props = {
    usernameInput: '',
    passwordInput: '',
    onUsernameInputChange: vi.fn(),
    onPasswordInputChange: vi.fn(),
    onSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    ...overrides,
  };
  render(<LoginForm {...props} />);
  return props;
}

describe('LoginForm', () => {
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

  it('links to the register page', () => {
    renderForm();

    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register');
  });
});
