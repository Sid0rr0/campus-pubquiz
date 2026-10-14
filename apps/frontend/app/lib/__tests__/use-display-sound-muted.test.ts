import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDisplaySoundMuted } from '@/app/lib/use-display-sound-muted';

const { mockSetMuted } = vi.hoisted(() => ({ mockSetMuted: vi.fn() }));
vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { setMuted: mockSetMuted },
}));

describe('useDisplaySoundMuted', () => {
  beforeEach(() => {
    mockSetMuted.mockClear();
  });

  it('passes the session mute setting to the sound registry', () => {
    renderHook(() => useDisplaySoundMuted(true));

    expect(mockSetMuted).toHaveBeenLastCalledWith(true);
  });

  it('follows the setting when the moderator unmutes', () => {
    const { rerender } = renderHook(
      ({ isMuted }) => useDisplaySoundMuted(isMuted),
      { initialProps: { isMuted: true } },
    );

    rerender({ isMuted: false });

    expect(mockSetMuted).toHaveBeenLastCalledWith(false);
  });
});
