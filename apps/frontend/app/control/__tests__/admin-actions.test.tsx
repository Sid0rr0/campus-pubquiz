import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminActions } from '@/app/control/admin-actions';

function renderActions(
  overrides: Partial<Parameters<typeof AdminActions>[0]> = {},
) {
  const onAction = vi.fn();
  render(
    <AdminActions
      canStartQuiz={false}
      canEndQuiz
      canCloseSession={false}
      canToggleJoinOverlay
      isLeaderboardVisible={false}
      isJoinOverlayVisible={false}
      isMediaFullscreen={false}
      canReplayMedia={false}
      canPauseMedia={false}
      isMediaPaused={false}
      isDisplaySoundMuted={false}
      onSetDisplaySoundMuted={vi.fn()}
      onAction={onAction}
      onCloseSession={vi.fn()}
      {...overrides}
    />,
  );
  return onAction;
}

describe('AdminActions — media playback row', () => {
  it('renders no playback row when there is no media to act on', () => {
    renderActions();

    expect(
      screen.queryByRole('button', { name: /play video again/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(pause|resume)$/i }),
    ).not.toBeInTheDocument();
  });

  it('puts Play again and Pause on their own row, apart from the Leaderboard row', () => {
    renderActions({ canReplayMedia: true, canPauseMedia: true });

    const leaderboardRow = screen.getByRole('button', {
      name: /leaderboard/i,
    }).parentElement!;
    const replay = screen.getByRole('button', { name: /play video again/i });
    const pause = screen.getByRole('button', { name: 'Pause' });

    expect(
      within(leaderboardRow).queryByRole('button', {
        name: /play video again/i,
      }),
    ).toBeNull();
    expect(replay.parentElement).toBe(pause.parentElement);
    expect(replay.parentElement).not.toBe(leaderboardRow);
    expect(replay.parentElement?.previousElementSibling).toBe(leaderboardRow);
  });

  it('dispatches TOGGLE_MEDIA_PAUSE from the Pause button', () => {
    const onAction = renderActions({ canPauseMedia: true });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onAction).toHaveBeenCalledWith('TOGGLE_MEDIA_PAUSE');
  });

  it('shows Resume while the media is paused', () => {
    renderActions({ canPauseMedia: true, isMediaPaused: true });

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pause' }),
    ).not.toBeInTheDocument();
  });

  it('shows Pause for audio even though Play again is unavailable', () => {
    renderActions({ canPauseMedia: true, canReplayMedia: false });

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /play video again/i }),
    ).not.toBeInTheDocument();
  });
});
