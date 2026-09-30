import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SubmitEvent } from 'react';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useTeamJoin } from '@/app/lib/use-team-join';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

// Exercises the REAL usePlayerGame (only socket.io-client is faked), unlike
// use-team-join.test.ts which mocks it entirely and so can't see bugs caused
// by its actual connect/reconnectedAt/acknowledgement timing.
const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: mockIo }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function getFakeSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

function fakeSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as SubmitEvent<HTMLFormElement>;
}

function renderSubmittedJoin() {
  const hook = renderHook(() => useTeamJoin(''));
  act(() => {
    hook.result.current.setNameInput('The Quizzards');
    hook.result.current.setCodeInput('ABCDEF');
  });
  act(() => {
    hook.result.current.handleJoin(fakeSubmitEvent());
  });
  return hook;
}

describe('useTeamJoin — real player hook', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
  });

  it('emits JOIN_PLAYERS exactly once for a single join, even though identity becoming known and the socket connecting both fire independently', () => {
    // The join-effect used to fire from two separate, near-simultaneous
    // triggers on a brand-new socket: teamName/activeJoinCode becoming known
    // (right after handleJoin), and that same socket's own 'connect' event
    // moments later. Both used to call joinTeam, sending two JOIN_PLAYERS
    // for the same brand-new team name — the second always lost the race
    // against the first's just-created row and came back "already
    // registered", even on a single, non-double-tapped submission.
    renderSubmittedJoin();
    const fakeSocket = getFakeSocket();
    // No connect yet — must not have sent prematurely.
    expect(fakeSocket.emit).not.toHaveBeenCalled();

    act(() => fakeSocket.serverConnects());

    const joinPlayersEmits = fakeSocket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS);
    expect(joinPlayersEmits).toHaveLength(1);
    expect(joinPlayersEmits[0].payload).toMatchObject({
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });
  });

  it("shows a rejected join's reason, and a retry starts a fresh connection and join", async () => {
    const reason = 'Team name "The Quizzards" is already registered';
    const { result } = renderSubmittedJoin();
    const firstSocket = getFakeSocket();
    act(() => firstSocket.serverConnects());

    await act(async () =>
      firstSocket.reject(SOCKET_EVENTS.JOIN_PLAYERS, reason),
    );

    expect(result.current.connectionError).toBe(reason);
    expect(result.current.team).toBeNull();

    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });
    const retrySocket = getFakeSocket();
    expect(retrySocket).not.toBe(firstSocket);
    act(() => retrySocket.serverConnects());
    expect(retrySocket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS)).toHaveLength(1);
    // The old reason is gone while the retry is in flight.
    expect(result.current.connectionError).toBeNull();
  });

  it('clears the join error once a later join is accepted', async () => {
    // reconnectedAt is a Date.now() stamp; two connects in the same
    // millisecond would look like one connection and skip the rejoin.
    vi.useFakeTimers({ toFake: ['Date'] });
    const { result } = renderSubmittedJoin();
    const socket = getFakeSocket();
    act(() => socket.serverConnects());
    await act(async () =>
      socket.reject(SOCKET_EVENTS.JOIN_PLAYERS, 'Wrong team code'),
    );
    expect(result.current.connectionError).toBe('Wrong team code');

    // A transport reconnect re-sends the join on the same socket.
    vi.setSystemTime(Date.now() + 1000);
    act(() => {
      socket.serverDisconnects();
      socket.serverConnects();
      // The server resends the state on every reconnect.
      socket.trigger(SOCKET_EVENTS.STATE_SYNC, {
        progress: { status: 'lobby' },
      });
    });
    await act(async () => {
      socket.acknowledge(SOCKET_EVENTS.JOIN_PLAYERS);
      socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: 1,
        teamName: 'The Quizzards',
        teamToken: 'token-1',
        teamCode: 'QUICK-JADE-FOX',
        answers: [],
        bonusAwards: [],
      });
    });

    expect(result.current.team).not.toBeNull();
    expect(result.current.connectionError).toBeNull();
    vi.useRealTimers();
  });
});
