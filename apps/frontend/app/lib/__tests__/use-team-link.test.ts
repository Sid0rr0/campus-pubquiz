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
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
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
    mockPush.mockReset();
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

  describe('leaving a session', () => {
    const ACCEPTED = {
      teamId: 7,
      teamName: 'The Quizzards',
      teamToken: 'token-1',
      teamCode: 'QUICK-JADE-FOX',
      answers: [],
      bonusAwards: [],
      roundRatings: [],
      feedback: { comment: '', topics: [] },
    };

    function linkedTeam() {
      window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
      window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
      const hook = renderHook(() => useTeamLink(''));
      const socket = latestSocket();
      act(() => socket.serverConnects());
      act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
      return { ...hook, socket };
    }

    it('clears everything stored and goes to the join screen when kicked', () => {
      const { result, socket } = linkedTeam();

      act(() => socket.trigger(SOCKET_EVENTS.TEAM_KICKED));

      expect(
        window.localStorage.getItem('campus-pubquiz-team-name'),
      ).toBeNull();
      expect(
        window.localStorage.getItem('campus-pubquiz-team-token'),
      ).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/play');
      expect(result.current.nameInput).toBe('');
      expect(result.current.connectionError).toBe(
        'You were removed from this team by the quiz master',
      );
    });

    it('emits a leave with the team id before clearing the session when logging out', () => {
      const { result, socket } = linkedTeam();

      act(() => result.current.handleLogOut());

      const leaves = socket.emitsOf(SOCKET_EVENTS.LEAVE_SESSION);
      expect(leaves).toHaveLength(1);
      expect(leaves[0].payload).toEqual({ teamId: 7 });
      expect(
        window.localStorage.getItem('campus-pubquiz-team-token'),
      ).toBeNull();
      expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe(
        'The Quizzards',
      );
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('keeps name and team code when the session closes', () => {
      const { result, socket } = linkedTeam();

      act(() =>
        socket.trigger(SOCKET_EVENTS.SESSION_CLOSED, { joinCode: 'ABCDEF' }),
      );

      expect(
        window.localStorage.getItem('campus-pubquiz-join-code'),
      ).toBeNull();
      expect(window.localStorage.getItem('campus-pubquiz-team-code')).toBe(
        'QUICK-JADE-FOX',
      );
      expect(result.current.nameInput).toBe('The Quizzards');
      expect(mockPush).toHaveBeenCalledWith('/play');
    });
  });
});
