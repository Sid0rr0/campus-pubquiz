import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubmitEvent } from 'react';
import { toast } from 'sonner';
import {
  NOT_YOUR_TEAM_ANSWER_ERROR,
  SEAT_TAKEN_REFUSAL_MARKER,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';
import { JOIN_RETRY_DELAY_MS } from '@/app/lib/team-link';
import { useTeamLink } from '@/app/lib/use-team-link';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

// Runs the REAL player hook over a fake socket. The ordering rules live in
// team-link.test.ts; this file covers only what the adapter itself does.
const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
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
    vi.mocked(toast.error).mockClear();
    mockIo.mockImplementation(() => createFakeSocket());
  });

  it('joins once on connect, then stores the token and team code once the join is accepted', () => {
    const { result } = renderHook(() => useTeamLink(''));
    act(() => {
      result.current.join.setNameInput('The Quizzards');
      result.current.join.setCodeInput('abcdef');
    });
    // A double tap: the second submit must not open a second connection.
    act(() => {
      result.current.join.handleJoin(fakeSubmitEvent());
      result.current.join.handleJoin(fakeSubmitEvent());
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
    expect(result.current.join.teamCodeInput).toBe('QUICK-JADE-FOX');
    expect(result.current.join.connectionError).toBeNull();
  });

  it('reconnects when the network returns and rejoins naming the earlier socket', () => {
    const { result } = renderHook(() => useTeamLink(''));
    act(() => {
      result.current.join.setNameInput('The Quizzards');
      result.current.join.setCodeInput('abcdef');
    });
    act(() => result.current.join.handleJoin(fakeSubmitEvent()));
    const socket = latestSocket();
    act(() => socket.serverConnects());
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

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);

    // Play the real socket: the old connection closes, a new id connects.
    act(() => socket.serverDisconnects('io client disconnect'));
    socket.id = 'fake-socket-id-2';
    act(() => socket.serverConnects());

    const joins = socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS);
    expect(joins).toHaveLength(2);
    expect(joins[1].payload).toMatchObject({
      previousSocketId: 'fake-socket-id',
    });
  });

  describe('the join form gate', () => {
    it('needs the join form when the phone has no team name', () => {
      const { result } = renderHook(() => useTeamLink(''));

      expect(result.current.join.needsJoinForm).toBe(true);
    });

    it('needs the join form for a restored team name with no game to reconnect to and no view', () => {
      window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');

      const { result } = renderHook(() => useTeamLink(''));

      expect(result.current.join.teamName).toBe('The Quizzards');
      expect(result.current.join.activeJoinCode).toBeNull();
      expect(result.current.join.needsJoinForm).toBe(true);
    });

    it('needs the join form when the join is refused and there is no team', async () => {
      const { result } = renderHook(() => useTeamLink(''));
      act(() => {
        result.current.join.setNameInput('The Quizzards');
        result.current.join.setCodeInput('abcdef');
      });
      act(() => result.current.join.handleJoin(fakeSubmitEvent()));
      const socket = latestSocket();
      act(() => socket.serverConnects());

      await act(async () =>
        socket.reject(SOCKET_EVENTS.JOIN_PLAYERS, 'Unknown game'),
      );

      expect(result.current.join.connectionError).toBe('Unknown game');
      expect(result.current.join.team).toBeNull();
      expect(result.current.join.needsJoinForm).toBe(true);
    });

    it('no longer needs the join form once a view has arrived', () => {
      window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
      window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
      const { result } = renderHook(() => useTeamLink(''));
      const socket = latestSocket();
      act(() => socket.serverConnects());

      act(() =>
        socket.trigger(
          SOCKET_EVENTS.STATE_SYNC,
          roomView(SOCKET_ROOMS.PLAYERS, {}),
        ),
      );

      expect(result.current.game?.view).toBeDefined();
      expect(result.current.join.needsJoinForm).toBe(false);
    });
  });

  describe('a phone whose team seat the server does not confirm', () => {
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

    const OPEN_QUESTION = {
      rounds: [{ questions: [{ id: 1, prompt: 'Capital of France?' }] }],
      progress: { status: 'question_open' as const },
    };

    function reconnectingTeam() {
      window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
      window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
      const hook = renderHook(() => useTeamLink(''));
      const socket = latestSocket();
      act(() => socket.serverConnects());
      act(() =>
        socket.trigger(
          SOCKET_EVENTS.STATE_SYNC,
          roomView(SOCKET_ROOMS.PLAYERS, OPEN_QUESTION),
        ),
      );
      act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
      return { ...hook, socket };
    }

    it('offers no answer form until the join is accepted, on the first connection and after a reconnect', () => {
      const { result, socket } = reconnectingTeam();
      expect(result.current.game?.view.isAnswerable).toBe(true);

      act(() => socket.serverDisconnects());
      act(() => socket.serverConnects());
      act(() =>
        socket.trigger(
          SOCKET_EVENTS.STATE_SYNC,
          roomView(SOCKET_ROOMS.PLAYERS, OPEN_QUESTION),
        ),
      );
      expect(result.current.game?.view.isAnswerable).toBe(false);

      act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
      expect(result.current.game?.view.isAnswerable).toBe(true);
    });

    it('asks again by itself when the rejoin is refused because an old socket holds the seat, and hides the refusal', async () => {
      vi.useFakeTimers();
      try {
        const { result, socket } = reconnectingTeam();
        act(() => socket.serverDisconnects());
        socket.sent.length = 0;
        act(() => socket.serverConnects());
        act(() =>
          socket.trigger(
            SOCKET_EVENTS.STATE_SYNC,
            roomView(SOCKET_ROOMS.PLAYERS, OPEN_QUESTION),
          ),
        );

        await act(async () =>
          socket.reject(
            SOCKET_EVENTS.JOIN_PLAYERS,
            `"The Quizzards" ${SEAT_TAKEN_REFUSAL_MARKER} — ask the quiz master`,
          ),
        );
        expect(result.current.join.connectionError).toBeNull();
        expect(socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS)).toHaveLength(1);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(JOIN_RETRY_DELAY_MS);
        });

        expect(socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS)).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('rejoins by itself, with no error toast, when an answer is refused as not its own team', async () => {
      const { result, socket } = reconnectingTeam();
      socket.sent.length = 0;

      let submitted: Promise<unknown> | undefined;
      act(() => {
        submitted = result.current.game?.submitAnswer(1, 7, 'Paris');
      });
      await act(async () => {
        socket.reject(SOCKET_EVENTS.SUBMIT_ANSWER, NOT_YOUR_TEAM_ANSWER_ERROR);
        await submitted;
      });

      expect(socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS)).toHaveLength(1);
      expect(result.current.game?.view.isAnswerable).toBe(false);
      expect(toast.error).not.toHaveBeenCalled();
    });
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
      expect(result.current.join.nameInput).toBe('');
      expect(result.current.join.connectionError).toBe(
        'You were removed from this team by the quiz master',
      );
    });

    it('emits a leave with the team id before clearing the session when logging out', () => {
      const { result, socket } = linkedTeam();

      act(() => result.current.join.handleLogOut());

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
      expect(result.current.join.nameInput).toBe('The Quizzards');
      expect(mockPush).toHaveBeenCalledWith('/play');
    });
  });
});
