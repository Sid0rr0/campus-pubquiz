import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FormEvent } from 'react';
import { useTeamJoin } from '@/app/lib/use-team-join';
import { socketResult } from '@/app/play/__tests__/test-utils';

const { mockUseGameSocket } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function fakeSubmitEvent() {
  return { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
}

describe('useTeamJoin — double-submit guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
  });

  it('ignores a second join submission fired before the first one settles', () => {
    // Reproduces a double-tapped "Join the quiz" button on a slow phone:
    // both clicks land before React re-renders past the form, so without a
    // guard both would fire JOIN_PLAYERS — the loser of that race against
    // the winner's freshly-created team row comes back "already registered"
    // even though the name was genuinely new.
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));

    const { result } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });

    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
      result.current.handleJoin(fakeSubmitEvent());
    });

    expect(joinTeam).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh submission once the prior attempt fails', () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));

    const { result, rerender } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    expect(joinTeam).toHaveBeenCalledTimes(1);

    mockUseGameSocket.mockReturnValue(
      socketResult({
        joinTeam,
        connectionError: 'Team name "The Quizzards" is already registered',
      }),
    );
    rerender();

    act(() => {
      result.current.setTeamCodeInput('QUICK-JADE-FOX');
    });
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });

    expect(joinTeam).toHaveBeenCalledTimes(2);
  });
});
