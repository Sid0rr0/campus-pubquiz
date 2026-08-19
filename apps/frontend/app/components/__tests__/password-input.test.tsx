import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput } from '@/app/components/password-input';

function renderWithLabel(props: React.ComponentProps<typeof PasswordInput>) {
  return render(
    <>
      <label htmlFor={props.id}>Password</label>
      <PasswordInput {...props} />
    </>,
  );
}

describe('PasswordInput', () => {
  it('renders as a password field by default', () => {
    renderWithLabel({ id: 'pw', value: 'secret', onChange: vi.fn() });

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('reveals the password as plain text when the toggle is clicked', async () => {
    const user = userEvent.setup();
    renderWithLabel({ id: 'pw', value: 'secret', onChange: vi.fn() });

    await user.click(screen.getByRole('button', { name: /show password/i }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: /hide password/i }),
    ).toBeInTheDocument();
  });

  it('hides the password again when the toggle is clicked a second time', async () => {
    const user = userEvent.setup();
    renderWithLabel({ id: 'pw', value: 'secret', onChange: vi.fn() });

    await user.click(screen.getByRole('button', { name: /show password/i }));
    await user.click(screen.getByRole('button', { name: /hide password/i }));

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('calls onChange with the input value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithLabel({ id: 'pw', value: '', onChange });

    await user.type(screen.getByLabelText('Password'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });
});
