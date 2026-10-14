import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLobbyChime } from '@/app/lib/use-lobby-chime';

const { mockPlay } = vi.hoisted(() => ({ mockPlay: vi.fn() }));
vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { play: mockPlay },
}));

interface Props {
  teams: { teamId: number }[];
  isConnected: boolean;
}

describe('useLobbyChime', () => {
  beforeEach(() => {
    mockPlay.mockClear();
  });

  it('chimes when a team joins while connected', () => {
    const { rerender } = renderHook(
      ({ teams, isConnected }: Props) => useLobbyChime(teams, isConnected),
      { initialProps: { teams: [{ teamId: 1 }], isConnected: true } },
    );

    rerender({ teams: [{ teamId: 1 }, { teamId: 2 }], isConnected: true });

    expect(mockPlay).toHaveBeenCalledWith('chime');
  });

  it('does not chime for teams that joined while the client was offline', () => {
    const { rerender } = renderHook(
      ({ teams, isConnected }: Props) => useLobbyChime(teams, isConnected),
      { initialProps: { teams: [{ teamId: 1 }], isConnected: true } },
    );

    rerender({ teams: [{ teamId: 1 }], isConnected: false });
    rerender({ teams: [{ teamId: 1 }, { teamId: 2 }], isConnected: true });

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('chimes again for a join after the reconnect snapshot', () => {
    const { rerender } = renderHook(
      ({ teams, isConnected }: Props) => useLobbyChime(teams, isConnected),
      { initialProps: { teams: [{ teamId: 1 }], isConnected: false } },
    );

    rerender({ teams: [{ teamId: 1 }, { teamId: 2 }], isConnected: true });
    expect(mockPlay).not.toHaveBeenCalled();

    rerender({
      teams: [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }],
      isConnected: true,
    });
    expect(mockPlay).toHaveBeenCalledWith('chime');
  });
});
