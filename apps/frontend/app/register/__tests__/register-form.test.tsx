import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RegisterForm } from '@/app/register/register-form';

function renderForm(
  overrides: Partial<React.ComponentProps<typeof RegisterForm>> = {},
) {
  const props = {
    usernameInput: '',
    passwordInput: '',
    confirmPasswordInput: '',
    onUsernameInputChange: vi.fn(),
    onPasswordInputChange: vi.fn(),
    onConfirmPasswordInputChange: vi.fn(),
    onSubmit: vi.fn((event: React.SubmitEvent<HTMLFormElement>) =>
      event.preventDefault(),
    ),
    ...overrides,
  };
  render(<RegisterForm {...props} />);
  return props;
}

describe('RegisterForm', () => {
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

  it('links to the login page', () => {
    renderForm();

    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
