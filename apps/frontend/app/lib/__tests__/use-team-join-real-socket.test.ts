import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SubmitEvent } from 'react';
import { useTeamJoin } from '@/app/lib/use-team-join';

// Exercises the REAL useGameSocket (only socket.io-client is faked), unlike
// use-team-join.test.ts which mocks useGameSocket entirely and so can't see
// bugs caused by its actual connect/reconnectedAt timing.
type Handler = (...args: unknown[]) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler[]>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    trigger(event: string, payload?: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
  };
}

const { mockIo } = vi.hoisted(() => ({
  mockIo: vi.fn(() => createFakeSocket()),
}));

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function getFakeSocket() {
  return mockIo.mock.results[mockIo.mock.results.length - 1]
    ?.value as ReturnType<typeof createFakeSocket>;
}

function fakeSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as SubmitEvent<HTMLFormElement>;
}

describe('useTeamJoin — real socket connect timing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIo.mockClear();
  });

  it('emits JOIN_PLAYERS exactly once for a single join, even though identity becoming known and the socket connecting both fire independently', () => {
    // The join-effect used to fire from two separate, near-simultaneous
    // triggers on a brand-new socket: teamName/activeJoinCode becoming known
    // (right after handleJoin), and that same socket's own 'connect' event
    // moments later. Both used to call joinTeam, sending two JOIN_PLAYERS
    // for the same brand-new team name — the second always lost the race
    // against the first's just-created row and came back "already
    // registered", even on a single, non-double-tapped submission.
    const { result } = renderHook(() => useTeamJoin(''));

    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('ABCDEF');
    });
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
    });

    const fakeSocket = getFakeSocket();
    // No connect yet — must not have sent prematurely.
    expect(fakeSocket.emit).not.toHaveBeenCalled();

    act(() => {
      fakeSocket.trigger('connect');
    });

    const joinPlayersEmits = fakeSocket.emit.mock.calls.filter(
      ([event]) => event === 'game:join_players',
    );
    expect(joinPlayersEmits).toHaveLength(1);
    expect(joinPlayersEmits[0][1]).toMatchObject({
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });
  });
});
