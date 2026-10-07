import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubmitEvent } from 'react';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useTeamLink } from '@/app/lib/use-team-link';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

// Runs the REAL player hook over a fake socket. The ordering rules live in
// team-link.test.ts; this file covers only what the adapter itself does.
const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

function fakeSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as SubmitEvent<HTMLFormElement>;
}

describe('useTeamLink', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
  });

  it('joins once on connect, then stores the token and team code once the join is accepted', () => {
    const { result } = renderHook(() => useTeamLink(''));
    act(() => {
      result.current.setNameInput('The Quizzards');
      result.current.setCodeInput('abcdef');
    });
    // A double tap: the second submit must not open a second connection.
    act(() => {
      result.current.handleJoin(fakeSubmitEvent());
      result.current.handleJoin(fakeSubmitEvent());
    });
    const socket = latestSocket();
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(socket.emit).not.toHaveBeenCalled();

    act(() => socket.serverConnects());

    const joins = socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS);
    expect(joins).toHaveLength(1);
    expect(joins[0].payload).toEqual({
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });

    act(() =>
      socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: 1,
        teamName: 'The Quizzards',
        teamToken: 'token-1',
        teamCode: 'QUICK-JADE-FOX',
        answers: [],
        bonusAwards: [],
        roundRatings: [],
        feedback: { comment: '', topics: [] },
      }),
    );

    expect(window.localStorage.getItem('campus-pubquiz-team-token')).toBe(
      'token-1',
    );
    expect(window.localStorage.getItem('campus-pubquiz-team-code')).toBe(
      'QUICK-JADE-FOX',
    );
    expect(result.current.teamCodeInput).toBe('QUICK-JADE-FOX');
    expect(result.current.connectionError).toBeNull();
  });
});
