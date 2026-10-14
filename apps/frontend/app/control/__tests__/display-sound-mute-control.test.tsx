import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisplaySoundMuteControl } from '@/app/control/display-sound-mute-control';

describe('DisplaySoundMuteControl', () => {
  it('shows sound on and offers to mute when the display is not muted', async () => {
    const onSetMuted = vi.fn();
    render(<DisplaySoundMuteControl isMuted={false} onSetMuted={onSetMuted} />);

    const toggle = screen.getByRole('switch', { name: /display sound/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(toggle);

    expect(onSetMuted).toHaveBeenCalledWith(true);
  });

  it('shows sound off and offers to unmute when the display is muted', async () => {
    const onSetMuted = vi.fn();
    render(<DisplaySoundMuteControl isMuted={true} onSetMuted={onSetMuted} />);

    const toggle = screen.getByRole('switch', { name: /display sound/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);

    expect(onSetMuted).toHaveBeenCalledWith(false);
  });
});
