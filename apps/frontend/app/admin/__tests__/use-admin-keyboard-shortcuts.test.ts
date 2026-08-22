import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  useAdminKeyboardShortcuts,
  type UseAdminKeyboardShortcutsOptions,
} from '@/app/admin/use-admin-keyboard-shortcuts';

function renderShortcuts(
  overrides: Partial<UseAdminKeyboardShortcutsOptions> = {},
) {
  const sendAction = vi.fn();
  const options: UseAdminKeyboardShortcutsOptions = {
    canAdvance: false,
    canGoToPreviousQuestion: false,
    hasUnrevealedTeams: false,
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
  it('sends ADVANCE on ArrowRight when advancing is allowed', async () => {
    const { sendAction } = renderShortcuts({ canAdvance: true });

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it('sends PREVIOUS on ArrowLeft when going back is allowed', async () => {
    const { sendAction } = renderShortcuts({ canGoToPreviousQuestion: true });

    await userEvent.keyboard('{ArrowLeft}');

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('sends REVEAL_NEXT_TEAM on ArrowRight instead of ADVANCE while teams remain hidden', async () => {
    const { sendAction } = renderShortcuts({
      canAdvance: true,
      hasUnrevealedTeams: true,
    });

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('REVEAL_NEXT_TEAM');
    expect(sendAction).not.toHaveBeenCalledWith('ADVANCE');
  });

  it('sends TOGGLE_LEADERBOARD on ArrowRight once every team has been revealed, instead of ADVANCE', async () => {
    const { sendAction } = renderShortcuts({
      canAdvance: true,
      isLeaderboardVisible: true,
      hasUnrevealedTeams: false,
    });

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_LEADERBOARD');
    expect(sendAction).not.toHaveBeenCalledWith('ADVANCE');
  });

  it('ignores ArrowRight while the leaderboard is visible with nothing left to advance to', async () => {
    const { sendAction } = renderShortcuts({
      canAdvance: false,
      isLeaderboardVisible: true,
      hasUnrevealedTeams: false,
    });

    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).not.toHaveBeenCalled();
  });

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
      canAdvance: true,
      canGoToPreviousQuestion: true,
      isLeaderboardVisible: false,
    });

    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{ArrowUp}');

    expect(sendAction).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('re-subscribes with fresh flags after a rerender', async () => {
    const { sendAction, rerender } = renderShortcuts({ canAdvance: false });

    await userEvent.keyboard('{ArrowRight}');
    expect(sendAction).not.toHaveBeenCalled();

    rerender({
      canAdvance: true,
      canGoToPreviousQuestion: false,
      hasUnrevealedTeams: false,
      isLeaderboardVisible: false,
      sendAction,
    });
    await userEvent.keyboard('{ArrowRight}');

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });
});
