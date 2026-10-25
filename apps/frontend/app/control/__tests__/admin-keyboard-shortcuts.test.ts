import { describe, expect, it } from 'vitest';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';

describe('ADMIN_SHORTCUTS', () => {
  it('gives every shortcut a key name and a description the guide can show', () => {
    for (const [id, shortcut] of Object.entries(ADMIN_SHORTCUTS)) {
      expect(shortcut.keyName.trim(), `${id} keyName`).not.toBe('');
      expect(shortcut.description.trim(), `${id} description`).not.toBe('');
    }
  });

  it('names each key the way the guide lists it', () => {
    const names = Object.fromEntries(
      Object.entries(ADMIN_SHORTCUTS).map(([id, s]) => [id, s.keyName]),
    );

    expect(names).toEqual({
      advance: 'Right arrow',
      previous: 'Left arrow',
      showLeaderboard: 'Up arrow',
      hideLeaderboard: 'Down arrow',
      toggleJoinOverlay: 'J',
      toggleMediaFullscreen: 'F',
      toggleMediaPause: 'Space',
      toggleDisplayMute: 'M',
    });
  });
});
