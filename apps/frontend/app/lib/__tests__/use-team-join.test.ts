import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SubmitEvent } from 'react';
import { useTeamJoin } from '@/app/lib/use-team-join';
import { socketResult } from '@/app/play/__tests__/test-utils';

const { mockUsePlayerGame } = vi.hoisted(() => ({
  mockUsePlayerGame: vi.fn(),
}));

vi.mock('@/app/lib/use-player-game', () => ({
  usePlayerGame: mockUsePlayerGame,
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
    mockUsePlayerGame.mockReset();
  });

  it('ignores a second join submission fired before the first one settles', () => {
    // Reproduces a double-tapped "Join the quiz" button on a slow phone:
    // both clicks land before React re-renders past the form, so without a
    // guard both would fire JOIN_PLAYERS — the loser of that race against
    // the winner's freshly-created team row comes back "already registered"
    // even though the name was genuinely new.
    const joinTeam = vi.fn().mockResolvedValue({ success: true });
    mockUsePlayerGame.mockReturnValue(socketResult({ joinTeam }));

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

  it("shows a rejected join's reason on the join screen and allows a fresh submission", async () => {
    const reason = 'Team name "The Quizzards" is already registered';
    const joinTeam = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: reason })
      .mockResolvedValue({ success: true });
    mockUsePlayerGame.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 1 }),
    );

    const { result, rerender } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });
    await act(async () => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    expect(joinTeam).toHaveBeenCalledTimes(1);
    expect(result.current.connectionError).toBe(reason);

    // Retrying forces a brand-new socket (see useTeamJoin's joinAttempt
    // comment) — simulate its connect landing, same as the real hook would
    // produce, with a fresh reconnectedAt.
    mockUsePlayerGame.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 2 }),
    );
    await act(async () => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    rerender();

    expect(joinTeam).toHaveBeenCalledTimes(2);
  });

  it('clears an earlier join error once a later join is accepted', async () => {
    const joinTeam = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'Wrong team code' })
      .mockResolvedValue({ success: true });
    mockUsePlayerGame.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 1 }),
    );
    const { result, rerender } = renderHook(() => useTeamJoin(''));
    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });
    await act(async () => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    expect(result.current.connectionError).toBe('Wrong team code');

    // A transport reconnect re-sends the join, and this time it is accepted.
    mockUsePlayerGame.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 2 }),
    );
    await act(async () => {
      rerender();
    });

    expect(result.current.connectionError).toBeNull();
  });

  it('keeps a refused connection visible and lets the next submission through', async () => {
    const joinTeam = vi.fn().mockResolvedValue({ success: true });
    mockUsePlayerGame.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: null }),
    );
    const { result, rerender } = renderHook(() => useTeamJoin(''));
    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });

    mockUsePlayerGame.mockReturnValue(
      socketResult({
        joinTeam,
        reconnectedAt: null,
        connectionError: 'Unknown session code',
      }),
    );
    rerender();
    expect(result.current.connectionError).toBe('Unknown session code');

    mockUsePlayerGame.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 1 }),
    );
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    rerender();

    expect(joinTeam).toHaveBeenCalledTimes(1);
  });
});

describe('useTeamJoin — log out leaves the session server-side', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUsePlayerGame.mockReset();
  });

  it('tells the server this team is leaving, with its own teamId, before clearing local storage', () => {
    // Reproduces the /control roster leak: logging out is the only way to
    // "rename" a team (log out, rejoin under a new name) — without this the
    // old identity's roster row lingers until an admin kicks it by hand.
    const leaveSession = vi.fn();
    mockUsePlayerGame.mockReturnValue(
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
    mockUsePlayerGame.mockReturnValue(socketResult({ leaveSession }));

    const { result } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.handleLogOut();
    });

    expect(leaveSession).not.toHaveBeenCalled();
  });
});
