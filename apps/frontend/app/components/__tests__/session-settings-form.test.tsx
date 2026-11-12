import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuizMode, SessionSettings } from '@campus-pubquiz/types';
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
  mode: QuizMode = 'pub',
) {
  function Wrapper() {
    const [value, setValue] = useState(initial);
    return (
      <SessionSettingsForm
        value={value}
        mode={mode}
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

  it('fires onChange with an updated maxPlayersPerTeam', async () => {
    const onChange = vi.fn();
    renderControlled(DEFAULT_SESSION_SETTINGS, onChange);

    const input = screen.getByLabelText(/max players per team/i);
    await userEvent.clear(input);
    await userEvent.type(input, '4');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      maxPlayersPerTeam: 4,
    });
  });

  it('fires onChange with an updated extraPlayerPenaltyPoints', async () => {
    const onChange = vi.fn();
    renderControlled(DEFAULT_SESSION_SETTINGS, onChange);

    const input = screen.getByLabelText(/extra player penalty/i);
    await userEvent.clear(input);
    await userEvent.type(input, '3');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      extraPlayerPenaltyPoints: 3,
    });
  });

  it('fires onChange with an updated quickfireQuestionTimerSeconds', async () => {
    const onChange = vi.fn();
    renderControlled(DEFAULT_SESSION_SETTINGS, onChange, 'quickfire');

    const input = screen.getByLabelText(/quickfire question timer/i);
    await userEvent.clear(input);
    await userEvent.type(input, '45');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      quickfireQuestionTimerSeconds: 45,
    });
  });

  it('clears quickfireQuestionTimerSeconds to null when the input is emptied', async () => {
    const onChange = vi.fn();
    renderControlled(
      { ...DEFAULT_SESSION_SETTINGS, quickfireQuestionTimerSeconds: 30 },
      onChange,
      'quickfire',
    );

    const input = screen.getByLabelText(/quickfire question timer/i);
    await userEvent.clear(input);

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      quickfireQuestionTimerSeconds: null,
    });
  });

  it('hides the quickfire question timer and shows jokers for a pub quiz', () => {
    renderControlled(DEFAULT_SESSION_SETTINGS, vi.fn());

    expect(
      screen.queryByLabelText(/quickfire question timer/i),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^jokers$/i)).toBeInTheDocument();
  });

  it('hides jokers for a quickfire quiz', () => {
    renderControlled(DEFAULT_SESSION_SETTINGS, vi.fn(), 'quickfire');

    expect(screen.queryByLabelText(/^jokers$/i)).not.toBeInTheDocument();
  });

  describe('Versus', () => {
    it('is off with no side list, and not offered for a quickfire quiz', () => {
      const { unmount } = renderControlled(DEFAULT_SESSION_SETTINGS, vi.fn());
      expect(screen.getByLabelText(/^versus$/i)).not.toBeChecked();
      expect(screen.queryByLabelText(/side 1 name/i)).not.toBeInTheDocument();
      unmount();

      renderControlled(DEFAULT_SESSION_SETTINGS, vi.fn(), 'quickfire');
      expect(screen.queryByLabelText(/^versus$/i)).not.toBeInTheDocument();
    });

    it('turns on with two sides, edits names, adds up to four, and submits the list', async () => {
      const onChange = vi.fn();
      renderControlled(DEFAULT_SESSION_SETTINGS, onChange);

      await userEvent.click(screen.getByLabelText(/^versus$/i));
      expect(screen.getAllByTestId('side-swatch')).toHaveLength(2);
      await userEvent.type(screen.getByLabelText(/side 1 name/i), 'Law');
      await userEvent.click(screen.getByRole('button', { name: /add side/i }));
      await userEvent.click(screen.getByRole('button', { name: /add side/i }));

      expect(screen.getAllByTestId('side-swatch')).toHaveLength(4);
      expect(screen.getByRole('button', { name: /add side/i })).toBeDisabled();
      const last = onChange.mock.lastCall![0] as SessionSettings;
      expect(last.versusEnabled).toBe(true);
      expect(last.versusSides.map((side) => side.name)).toEqual([
        'Law',
        '',
        '',
        '',
      ]);
    });

    it('removes a side down to two', async () => {
      renderControlled(
        {
          ...DEFAULT_SESSION_SETTINGS,
          versusEnabled: true,
          versusSides: [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
            { id: 'c', name: 'C' },
          ],
        },
        vi.fn(),
      );

      await userEvent.click(
        screen.getByRole('button', { name: /remove side 3/i }),
      );

      expect(screen.getAllByTestId('side-swatch')).toHaveLength(2);
      expect(
        screen.getByRole('button', { name: /remove side 1/i }),
      ).toBeDisabled();
    });
  });

  it('toggles a bonus category off', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
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
        mode="pub"
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
        mode="pub"
      />,
    );

    await userEvent.click(screen.getByLabelText(/autoplay media/i));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      autoplayMedia: false,
    });
  });

  it('toggles playLockCountdownSound off', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
      />,
    );

    await userEvent.click(screen.getByLabelText(/^countdown sound$/i));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      playLockCountdownSound: false,
    });
  });

  it('toggles showRoundOverview off', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
      />,
    );

    await userEvent.click(screen.getByLabelText(/show round overview/i));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      showRoundOverview: !DEFAULT_SESSION_SETTINGS.showRoundOverview,
      // The extra joker's cost follows the overview while it is the default.
      powerUps: {
        ...DEFAULT_SESSION_SETTINGS.powerUps,
        extra_joker: { cost: 6, maxUses: 1 },
      },
    });
  });

  it('turns the round overview on with Jokers, and starts with Jokers off', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={{ ...DEFAULT_SESSION_SETTINGS, showRoundOverview: false }}
        onChange={onChange}
        mode="pub"
      />,
    );
    const toggle = screen.getByLabelText(/^jokers$/i);
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      showRoundOverview: true,
      jokersEnabled: true,
      powerUps: {
        ...DEFAULT_SESSION_SETTINGS.powerUps,
        extra_joker: { cost: 6, maxUses: 1 },
      },
    });
  });

  it('keeps the round overview switch on and disabled while Jokers is on', () => {
    render(
      <SessionSettingsForm
        value={{
          ...DEFAULT_SESSION_SETTINGS,
          showRoundOverview: true,
          jokersEnabled: true,
        }}
        onChange={vi.fn()}
        mode="pub"
      />,
    );

    const overview = screen.getByLabelText(/show round overview/i);
    expect(overview).toBeChecked();
    expect(overview).toBeDisabled();
    expect(screen.getByLabelText(/^jokers$/i)).toBeChecked();
  });

  it('lets the round overview switch be used again once Jokers is off', () => {
    render(
      <SessionSettingsForm
        value={{ ...DEFAULT_SESSION_SETTINGS, showRoundOverview: true }}
        onChange={vi.fn()}
        mode="pub"
      />,
    );

    expect(screen.getByLabelText(/show round overview/i)).toBeEnabled();
  });

  it('toggles the early answer reveal on for a pub quiz, and does not offer it for quickfire', async () => {
    const onChange = vi.fn();
    renderControlled(DEFAULT_SESSION_SETTINGS, onChange);
    const toggle = screen.getByLabelText(/show correct answers before break/i);
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      earlyAnswerReveal: true,
    });
    cleanup();
    renderControlled(DEFAULT_SESSION_SETTINGS, vi.fn(), 'quickfire');
    expect(
      screen.queryByLabelText(/show correct answers before break/i),
    ).not.toBeInTheDocument();
  });

  it('toggles collectFeedback off, and it starts on', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
      />,
    );
    const toggle = screen.getByLabelText(/collect feedback/i);
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      collectFeedback: false,
    });
  });

  it('toggles funFactsEnabled off, and it starts on', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
      />,
    );
    const toggle = screen.getByLabelText(/fun facts on the break screen/i);
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      funFactsEnabled: false,
    });
  });

  it('toggles listed off, and it starts on', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
      />,
    );
    const toggle = screen.getByLabelText(/show in the game list/i);
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      listed: false,
    });
  });

  it('adds a new blank rule line', async () => {
    const onChange = vi.fn();
    render(
      <SessionSettingsForm
        value={DEFAULT_SESSION_SETTINGS}
        onChange={onChange}
        mode="pub"
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
        mode="pub"
      />,
    );

    await userEvent.click(screen.getByLabelText(/remove rule 1/i));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SESSION_SETTINGS,
      rules: ['Rule two.'],
    });
  });
});
