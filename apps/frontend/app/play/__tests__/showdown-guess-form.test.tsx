import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ShowdownGuessForm } from '@/app/play/showdown-guess-form';

async function submitGuess(value: string) {
  await userEvent.type(screen.getByLabelText('Your guess'), value);
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
}

describe('ShowdownGuessForm', () => {
  it('waits for other teams once the server accepted the guess', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(
      <ShowdownGuessForm
        question="How many?"
        hasGuessed={false}
        onSubmit={onSubmit}
      />,
    );

    await submitGuess('42');

    expect(onSubmit).toHaveBeenCalledWith('42');
    expect(await screen.findByText('Waiting for other teams…')).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();
  });

  it('keeps the form, with the guess in it, when the server refused it', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Not connected' });
    render(
      <ShowdownGuessForm
        question="How many?"
        hasGuessed={false}
        onSubmit={onSubmit}
      />,
    );

    await submitGuess('42');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Waiting for other teams…'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your guess')).toHaveValue(42);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
