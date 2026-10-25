import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  useAdminKeyboardShortcuts,
  useAdminMediaPauseShortcut,
  type UseAdminKeyboardShortcutsOptions,
} from '@/app/control/use-admin-keyboard-shortcuts';

function renderShortcuts(
  overrides: Partial<UseAdminKeyboardShortcutsOptions> = {},
) {
  const sendAction = vi.fn();
  const setDisplaySoundMuted = vi.fn();
  const options: UseAdminKeyboardShortcutsOptions = {
    advanceStep: 'none',
    previousState: 'unavailable',
    isLeaderboardVisible: false,
    canToggleJoinOverlay: true,
    canPauseMedia: false,
    isDisplaySoundMuted: false,
    sendAction,
    setDisplaySoundMuted,
    ...overrides,
  };
  const { rerender } = renderHook(
    (props: UseAdminKeyboardShortcutsOptions) =>
      useAdminKeyboardShortcuts(props),
    {
      initialProps: options,
    },
  );
  return { sendAction, setDisplaySoundMuted, rerender };
}

function pressKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    cancelable: true,
    bubbles: true,
  });
  window.dispatchEvent(event);
  return event;
}

describe('useAdminMediaPauseShortcut', () => {
  it('sends TOGGLE_MEDIA_PAUSE on Space and claims it from the browser while Pause shows', () => {
    const sendAction = vi.fn();
    renderHook(() =>
      useAdminMediaPauseShortcut({ canPauseMedia: true, sendAction }),
    );

    expect(pressKey(' ').defaultPrevented).toBe(true);
    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_PAUSE');
  });

  it('leaves Space alone while there is nothing to pause', () => {
    const sendAction = vi.fn();
    renderHook(() =>
      useAdminMediaPauseShortcut({ canPauseMedia: false, sendAction }),
    );

    expect(pressKey(' ').defaultPrevented).toBe(false);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('follows canPauseMedia and sendAction across rerenders', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      (props: { canPauseMedia: boolean; sendAction: () => void }) =>
        useAdminMediaPauseShortcut(props),
      { initialProps: { canPauseMedia: false, sendAction: first } },
    );

    pressKey(' ');
    rerender({ canPauseMedia: true, sendAction: second });
    pressKey(' ');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const sendAction = vi.fn();
    renderHook(() =>
      useAdminMediaPauseShortcut({ canPauseMedia: true, sendAction }),
    );

    expect(pressKey('x').defaultPrevented).toBe(false);
    expect(sendAction).not.toHaveBeenCalled();
  });
});

describe('useAdminKeyboardShortcuts', () => {
  it.each(['advance', 'reveal_next_rank', 'hide_leaderboard'] as const)(
    'sends ADVANCE on ArrowRight when the announced step is %s',
    async (advanceStep) => {
      const { sendAction } = renderShortcuts({
        advanceStep,
        isLeaderboardVisible: advanceStep !== 'advance',
      });

      await userEvent.keyboard('{ArrowRight}');

      expect(sendAction).toHaveBeenCalledTimes(1);
      expect(sendAction).toHaveBeenCalledWith('ADVANCE');
    },
  );

  it('ignores ArrowRight when the announced step is none', async () => {
    const { sendAction } = renderShortcuts({
      advanceStep: 'none',
      isLeaderboardVisible: true,
    });

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends PREVIOUS on ArrowLeft when Previous is available', async () => {
    const { sendAction } = renderShortcuts({ previousState: 'available' });

    await userEvent.keyboard('{ArrowLeft}');

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it.each(['covered_by_leaderboard', 'unavailable'] as const)(
    'ignores ArrowLeft when Previous is %s',
    async (previousState) => {
      const { sendAction } = renderShortcuts({
        previousState,
        isLeaderboardVisible: previousState === 'covered_by_leaderboard',
      });

      await userEvent.keyboard('{ArrowLeft}');

      expect(sendAction).not.toHaveBeenCalled();
    },
  );

  it('sends TOGGLE_LEADERBOARD on ArrowUp only while the leaderboard is hidden', async () => {
    const { sendAction } = renderShortcuts({ isLeaderboardVisible: false });

    await userEvent.keyboard('{ArrowUp}');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('sends TOGGLE_LEADERBOARD on ArrowDown only while the leaderboard is visible', async () => {
    const { sendAction } = renderShortcuts({ isLeaderboardVisible: true });

    await userEvent.keyboard('{ArrowDown}');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
  });

  it('ignores ArrowDown while the leaderboard is already hidden', async () => {
    const { sendAction } = renderShortcuts({ isLeaderboardVisible: false });

    await userEvent.keyboard('{ArrowDown}');

    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends TOGGLE_JOIN_OVERLAY on J whether or not the overlay is up', async () => {
    const { sendAction } = renderShortcuts();

    await userEvent.keyboard('j');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_JOIN_OVERLAY');
  });

  it('ignores J where the overlay cannot be toggled (lobby, ended)', async () => {
    const { sendAction } = renderShortcuts({ canToggleJoinOverlay: false });

    await userEvent.keyboard('j');

    expect(sendAction).not.toHaveBeenCalled();
  });

  it('ignores J while an editable field is focused', async () => {
    document.body.innerHTML = '<input id="target" />';
    (document.getElementById('target') as HTMLInputElement).focus();
    const { sendAction } = renderShortcuts();

    await userEvent.keyboard('j');

    expect(sendAction).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('ignores arrow keys while an editable field is focused', async () => {
    document.body.innerHTML = '<input id="target" />';
    const input = document.getElementById('target') as HTMLInputElement;
    input.focus();

    const { sendAction } = renderShortcuts({
      advanceStep: 'advance',
      previousState: 'available',
      isLeaderboardVisible: false,
    });

    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{ArrowUp}');

    expect(sendAction).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('sends TOGGLE_MEDIA_FULLSCREEN on F regardless of other flags', async () => {
    const { sendAction } = renderShortcuts();

    await userEvent.keyboard('f');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_FULLSCREEN');
  });

  it('no longer sends TOGGLE_MEDIA_FULLSCREEN on Space', async () => {
    const { sendAction } = renderShortcuts({ canPauseMedia: false });

    await userEvent.keyboard(' ');

    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends TOGGLE_MEDIA_PAUSE on Space when the media can be paused', async () => {
    const { sendAction } = renderShortcuts({ canPauseMedia: true });

    await userEvent.keyboard(' ');

    expect(sendAction).toHaveBeenCalledTimes(1);
    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_PAUSE');
  });

  it('leaves Space to the browser when nothing can be paused', () => {
    renderShortcuts({ canPauseMedia: false });
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      cancelable: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('prevents the default scroll on Space when it pauses media', () => {
    renderShortcuts({ canPauseMedia: true });
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      cancelable: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it.each([false, true])(
    'sets the display mute to the opposite of %s on M',
    async (isDisplaySoundMuted) => {
      const { setDisplaySoundMuted } = renderShortcuts({ isDisplaySoundMuted });

      await userEvent.keyboard('m');

      expect(setDisplaySoundMuted).toHaveBeenCalledTimes(1);
      expect(setDisplaySoundMuted).toHaveBeenCalledWith(!isDisplaySoundMuted);
    },
  );

  it.each(['F', 'J', 'M'])(
    'matches uppercase %s (Shift or Caps Lock)',
    async (key) => {
      const { sendAction, setDisplaySoundMuted } = renderShortcuts();

      await userEvent.keyboard(key);

      expect(
        sendAction.mock.calls.length + setDisplaySoundMuted.mock.calls.length,
      ).toBe(1);
    },
  );

  it.each([
    ['ctrlKey', 'f'],
    ['metaKey', 'f'],
    ['metaKey', 'm'],
    ['ctrlKey', 'j'],
    ['altKey', 'm'],
    ['metaKey', ' '],
    ['metaKey', 'ArrowRight'],
    ['ctrlKey', 'ArrowLeft'],
    ['altKey', 'ArrowUp'],
    ['metaKey', 'ArrowDown'],
  ] as const)(
    'ignores %s + %j and leaves it to the browser',
    (modifier, key) => {
      const { sendAction, setDisplaySoundMuted } = renderShortcuts({
        canPauseMedia: true,
        advanceStep: 'advance',
        previousState: 'available',
        isLeaderboardVisible: key === 'ArrowDown',
      });
      const event = new KeyboardEvent('keydown', {
        key,
        [modifier]: true,
        cancelable: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(sendAction).not.toHaveBeenCalled();
      expect(setDisplaySoundMuted).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it('still handles Shift+F', async () => {
    const { sendAction } = renderShortcuts();

    await userEvent.keyboard('{Shift>}f{/Shift}');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_FULLSCREEN');
  });

  it.each(['f', 'm', ' '])(
    'ignores %j while an editable field is focused',
    async (key) => {
      document.body.innerHTML = '<input id="target" />';
      const input = document.getElementById('target') as HTMLInputElement;
      input.focus();

      const { sendAction, setDisplaySoundMuted } = renderShortcuts({
        canPauseMedia: true,
      });

      await userEvent.keyboard(key);

      expect(sendAction).not.toHaveBeenCalled();
      expect(setDisplaySoundMuted).not.toHaveBeenCalled();
      document.body.innerHTML = '';
    },
  );

  it.each([
    ['ArrowLeft', { previousState: 'available' }],
    ['ArrowRight', { advanceStep: 'advance' }],
    ['ArrowUp', { isLeaderboardVisible: false }],
    ['ArrowDown', { isLeaderboardVisible: true }],
    ['j', {}],
    ['f', {}],
    [' ', { canPauseMedia: true }],
    ['m', {}],
  ] as const)(
    'claims %j from the browser when it acts on it',
    (key, overrides) => {
      renderShortcuts(overrides);

      expect(pressKey(key).defaultPrevented).toBe(true);
    },
  );

  it.each(['x', 'Enter', 'Tab'])(
    'does nothing for the unbound key %j, even with the leaderboard up',
    (key) => {
      const { sendAction, setDisplaySoundMuted } = renderShortcuts({
        isLeaderboardVisible: true,
        advanceStep: 'advance',
        previousState: 'available',
        canPauseMedia: true,
      });

      expect(pressKey(key).defaultPrevented).toBe(false);
      expect(sendAction).not.toHaveBeenCalled();
      expect(setDisplaySoundMuted).not.toHaveBeenCalled();
    },
  );

  it.each(['TEXTAREA', 'SELECT'])(
    'ignores shortcut keys while a %s is focused',
    async (tag) => {
      document.body.innerHTML = `<${tag.toLowerCase()} id="target"></${tag.toLowerCase()}>`;
      document.getElementById('target')?.focus();
      const { sendAction, setDisplaySoundMuted } = renderShortcuts({
        canPauseMedia: true,
      });

      await userEvent.keyboard('fm');

      expect(sendAction).not.toHaveBeenCalled();
      expect(setDisplaySoundMuted).not.toHaveBeenCalled();
      document.body.innerHTML = '';
    },
  );

  it('re-subscribes with a fresh announced step after a rerender', async () => {
    const { sendAction, rerender } = renderShortcuts({ advanceStep: 'none' });

    await userEvent.keyboard('{ArrowRight}');
    expect(sendAction).not.toHaveBeenCalled();

    rerender({
      advanceStep: 'advance',
      previousState: 'unavailable',
      isLeaderboardVisible: false,
      canToggleJoinOverlay: true,
      canPauseMedia: false,
      isDisplaySoundMuted: false,
      sendAction,
      setDisplaySoundMuted: vi.fn(),
    });
    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });
});
