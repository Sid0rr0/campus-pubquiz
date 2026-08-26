import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsModal } from '@/app/play/settings-modal';

describe('SettingsModal', () => {
  it('renders nothing when closed', () => {
    render(
      <SettingsModal
        isOpen={false}
        onOpenChange={vi.fn()}
        autoAdvanceEnabled={true}
        onAutoAdvanceChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the auto-advance checkbox checked when the setting is on', () => {
    render(
      <SettingsModal
        isOpen={true}
        onOpenChange={vi.fn()}
        autoAdvanceEnabled={true}
        onAutoAdvanceChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    ).toBeChecked();
  });

  it('shows the checkbox unchecked when the setting is off', () => {
    render(
      <SettingsModal
        isOpen={true}
        onOpenChange={vi.fn()}
        autoAdvanceEnabled={false}
        onAutoAdvanceChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    ).not.toBeChecked();
  });

  it('calls onAutoAdvanceChange with the new value when toggled', async () => {
    const onAutoAdvanceChange = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onOpenChange={vi.fn()}
        autoAdvanceEnabled={true}
        onAutoAdvanceChange={onAutoAdvanceChange}
      />,
    );

    await userEvent.click(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    );

    expect(onAutoAdvanceChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Close is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onOpenChange={onOpenChange}
        autoAdvanceEnabled={true}
        onAutoAdvanceChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
