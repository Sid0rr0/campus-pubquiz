import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SubmitEvent } from 'react';
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
  return { preventDefault: vi.fn() } as unknown as SubmitEvent<HTMLFormElement>;
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
    mockUseGameSocket.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 1 }),
    );

    const { result, rerender } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    expect(joinTeam).toHaveBeenCalledTimes(1);

    // Same connection, the server just rejects the name — reconnectedAt is
    // unchanged.
    mockUseGameSocket.mockReturnValue(
      socketResult({
        joinTeam,
        reconnectedAt: 1,
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
    expect(joinTeam).toHaveBeenCalledTimes(1);

    // Retrying forces a brand-new socket (see useTeamJoin's joinAttempt
    // comment) — simulate its connect landing, same as the real hook would
    // produce, with a fresh reconnectedAt.
    mockUseGameSocket.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 2 }),
    );
    rerender();

    expect(joinTeam).toHaveBeenCalledTimes(2);
  });
});

describe('useTeamJoin — log out leaves the session server-side', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGameSocket.mockReset();
  });

  it('tells the server this team is leaving, with its own teamId, before clearing local storage', () => {
    // Reproduces the /control roster leak: logging out is the only way to
    // "rename" a team (log out, rejoin under a new name) — without this the
    // old identity's roster row lingers until an admin kicks it by hand.
    const leaveSession = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        leaveSession,
        team: {
          teamId: 31,
          teamToken: 'team-token-1',
          teamCode: 'team-code-1',
          teamName: 'The Quizzards',
          answers: [],
          bonusAwards: [],
        },
      }),
    );

    const { result } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.handleLogOut();
    });

    expect(leaveSession).toHaveBeenCalledExactlyOnceWith(31);
  });

  it('does not call leaveSession when logging out with no confirmed team', () => {
    const leaveSession = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ leaveSession }));

    const { result } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.handleLogOut();
    });

    expect(leaveSession).not.toHaveBeenCalled();
  });
});
