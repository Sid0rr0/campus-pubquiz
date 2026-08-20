import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SessionSettings } from '@campus-pubquiz/types';
import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { SessionSettingsForm } from '@/app/components/session-settings-form';

// SessionSettingsForm is a purely controlled component (no internal state):
// simulating a multi-keystroke edit requires a stateful wrapper that feeds
// each onChange back in as the next value prop, the same way both real call
// sites (session-picker-panel/session-settings-panel) already do — otherwise
// the input snaps back to its original static prop value after every key.
function renderControlled(
  initial: SessionSettings,
  onChange: (next: SessionSettings) => void,
) {
  function Wrapper() {
    const [value, setValue] = useState(initial);
    return (
      <SessionSettingsForm
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }
  return render(<Wrapper />);
}

describe('SessionSettingsForm', () => {
  it('fires onChange with an updated lockGraceSeconds', async () => {
    const onChange = vi.fn();
    renderControlled(DEFAULT_SESSION_SETTINGS, onChange);

    const input = screen.getByLabelText(/lock round after/i);
    await userEvent.clear(input);
    await userEvent.type(input, '15');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
    });
  });

  it('toggles a bonus category off', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^selfie/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      enabledBonusCategories: ['shot', 'custom'],
    });
  });

  it('sets a max award-count cap for a category', async () => {
    const onChange = vi.fn();
    renderControlled(
      { ...DEFAULT_SESSION_SETTINGS, maxBonusAwardsPerCategory: {} },
      onChange,
    );

    const input = screen.getByLabelText(/max shot awards/i);
    await userEvent.type(input, '2');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      maxBonusAwardsPerCategory: { shot: 2 },
    });
  });

  it('clears a max award-count cap when the input is emptied', async () => {
    const onChange = vi.fn();
    renderControlled(
      {
        ...DEFAULT_SESSION_SETTINGS,
        maxBonusAwardsPerCategory: { shot: 2 },
      },
      onChange,
    );

    const input = screen.getByLabelText(/max shot awards/i);
    await userEvent.clear(input);

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      maxBonusAwardsPerCategory: {},
    });
  });

  it('shows the default point value next to each bonus category', () => {
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /^shot.*1 pt/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^selfie.*1 pt/i }),
    ).toBeInTheDocument();
  });

  it('toggles autoplayMedia off', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByLabelText(/autoplay media/i));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      autoplayMedia: false,
    });
  });

  it('adds a new blank rule line', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add rule/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      rules: [...DEFAULT_SESSION_SETTINGS.rules, ''],
    });
  });

  it('edits an existing rule line', async () => {
    const onChange = vi.fn();
    renderControlled(
      { ...DEFAULT_SESSION_SETTINGS, rules: ['Original rule.'] },
      onChange,
    );

    const input = screen.getByLabelText(/^rule 1$/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Edited rule.');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      rules: ['Edited rule.'],
    });
  });

  it('removes a rule line', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={{
          ...DEFAULT_SESSION_SETTINGS,
          rules: ['Rule one.', 'Rule two.'],
        }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByLabelText(/remove rule 1/i));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      rules: ['Rule two.'],
    });
  });
});
