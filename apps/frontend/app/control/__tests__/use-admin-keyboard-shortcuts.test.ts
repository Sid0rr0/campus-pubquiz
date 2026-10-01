import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  useAdminKeyboardShortcuts,
  type UseAdminKeyboardShortcutsOptions,
} from '@/app/control/use-admin-keyboard-shortcuts';

function renderShortcuts(
  overrides: Partial<UseAdminKeyboardShortcutsOptions> = {},
) {
  const sendAction = vi.fn();
  const options: UseAdminKeyboardShortcutsOptions = {
    advanceStep: 'none',
    previousState: 'unavailable',
    isLeaderboardVisible: false,
    sendAction,
    ...overrides,
  };
  const { rerender } = renderHook(
    (props: UseAdminKeyboardShortcutsOptions) =>
      useAdminKeyboardShortcuts(props),
    {
      initialProps: options,
    },
  );
  return { sendAction, rerender };
}

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

  it('sends TOGGLE_MEDIA_FULLSCREEN on Space regardless of other flags', async () => {
    const { sendAction } = renderShortcuts();

    await userEvent.keyboard(' ');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_FULLSCREEN');
  });

  it('ignores Space while an editable field is focused', async () => {
    document.body.innerHTML = '<input id="target" />';
    const input = document.getElementById('target') as HTMLInputElement;
    input.focus();

    const { sendAction } = renderShortcuts();

    await userEvent.keyboard(' ');

    expect(sendAction).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('re-subscribes with a fresh announced step after a rerender', async () => {
    const { sendAction, rerender } = renderShortcuts({ advanceStep: 'none' });

    await userEvent.keyboard('{ArrowRight}');
    expect(sendAction).not.toHaveBeenCalled();

    rerender({
      advanceStep: 'advance',
      previousState: 'unavailable',
      isLeaderboardVisible: false,
      sendAction,
    });
    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });
});
