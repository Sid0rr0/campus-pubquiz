import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS,
  type SessionSettings,
} from '@campus-pubquiz/types';
import {
  PowerUpsSettingsForm,
  withShowRoundOverview,
} from '@/app/components/power-ups-settings-form';

function renderControlled(
  initial: SessionSettings,
  onChange: (next: SessionSettings) => void,
) {
  function Wrapper() {
    const [value, setValue] = useState(initial);
    return (
      <PowerUpsSettingsForm
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

const ON: SessionSettings = {
  ...DEFAULT_SESSION_SETTINGS,
  powerUpsEnabled: true,
};

describe('PowerUpsSettingsForm', () => {
  it('shows only the switch while power-ups are off, and turns them on', async () => {
    const onChange = vi.fn();
    renderControlled(DEFAULT_SESSION_SETTINGS, onChange);

    expect(screen.queryByLabelText(/starting coins/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Power-ups' }));

    expect(onChange).toHaveBeenLastCalledWith({ ...ON });
    expect(screen.getByLabelText(/starting coins/i)).toHaveValue(1);
  });

  it('edits the starting coins', async () => {
    const onChange = vi.fn();
    renderControlled(ON, onChange);

    const input = screen.getByLabelText(/starting coins/i);
    await userEvent.clear(input);
    await userEvent.type(input, '4');

    expect(onChange).toHaveBeenLastCalledWith({ ...ON, startingCoins: 4 });
  });

  it('stores an unticked power-up as maxUses 0 and hides its cost', async () => {
    const onChange = vi.fn();
    renderControlled(ON, onChange);

    await userEvent.click(screen.getByRole('checkbox', { name: '50/50' }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...ON,
      powerUps: {
        ...ON.powerUps,
        fifty_fifty: { cost: 1, maxUses: 0 },
      },
    });
    expect(screen.queryByLabelText('50/50 cost')).not.toBeInTheDocument();
  });

  it('edits a power-up cost and its uses per team', async () => {
    const onChange = vi.fn();
    renderControlled(ON, onChange);

    const cost = screen.getByLabelText('Ask the room cost');
    await userEvent.clear(cost);
    await userEvent.type(cost, '5');
    const uses = screen.getByLabelText('Pin one max uses');
    await userEvent.tripleClick(uses);
    await userEvent.keyboard('3');

    expect(onChange).toHaveBeenLastCalledWith({
      ...ON,
      powerUps: {
        ...ON.powerUps,
        ask_the_room: { cost: 5, maxUses: 1 },
        pin_one: { cost: 1, maxUses: 3 },
      },
    });
  });
});

describe('withShowRoundOverview', () => {
  it('moves the extra joker cost with the overview while it is still the default', () => {
    const next = withShowRoundOverview(DEFAULT_SESSION_SETTINGS, true);

    expect(next.showRoundOverview).toBe(true);
    expect(next.powerUps.extra_joker.cost).toBe(3);
    expect(withShowRoundOverview(next, false).powerUps.extra_joker.cost).toBe(
      2,
    );
  });

  it('leaves an edited extra joker cost alone', () => {
    const edited = {
      ...DEFAULT_SESSION_SETTINGS,
      powerUps: {
        ...DEFAULT_SESSION_SETTINGS.powerUps,
        extra_joker: { cost: 5, maxUses: 1 },
      },
    };

    expect(withShowRoundOverview(edited, true).powerUps.extra_joker.cost).toBe(
      5,
    );
  });
});
