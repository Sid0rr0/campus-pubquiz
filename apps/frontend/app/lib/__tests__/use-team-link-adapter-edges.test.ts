import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubmitEvent } from 'react';
import {
  SEAT_TAKEN_REFUSAL_MARKER,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
} from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';
import {
  BONUS_AWARD_TOAST_DURATION_MS,
  JOIN_RETRY_DELAY_MS,
} from '@/app/lib/team-link';
import {
  SUBMIT_CONFIRM_TIMEOUT_MS,
  useTeamLink,
} from '@/app/lib/use-team-link';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

// What the adapter does around the Team link: the toasts' options, the timers
// it owns, what a new identity wipes, and the guards on the join form.
const { mockIo, mockToast, mockToastError, mockToastSuccess } = vi.hoisted(
  () => ({
    mockIo: vi.fn(),
    mockToast: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }),
);

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    error: mockToastError,
    success: mockToastSuccess,
  }),
}));

const ACCEPTED = {
  teamId: 31,
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'CODE',
  answers: [
    {
      questionId: 20,
      value: 'Paris',
      pointsAwarded: 2,
      gradedAt: '2026-10-01T10:00:00.000Z',
      verdict: 'correct',
    },
  ],
  bonusAwards: [],
  roundRatings: [],
  feedback: { comment: '', topics: [] },
  playerCount: null,
};

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

function submitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as SubmitEvent<HTMLFormElement>;
}

type Hook = ReturnType<typeof renderHook<ReturnType<typeof useTeamLink>, void>>;

function joinGame(hook: Hook, name: string, code: string) {
  act(() => {
    hook.result.current.join.setNameInput(name);
    hook.result.current.join.setCodeInput(code);
  });
  act(() => hook.result.current.join.handleJoin(submitEvent()));
  return latestSocket();
}

/** A phone that joined, was accepted and has received its first view. */
function renderPlayingTeam() {
  const hook = renderHook(() => useTeamLink(''));
  const socket = joinGame(hook, 'The Quizzards', 'abcdef');
  act(() => socket.serverConnects());
  act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
  act(() =>
    socket.trigger(
      SOCKET_EVENTS.STATE_SYNC,
      roomView(SOCKET_ROOMS.PLAYERS, {}),
    ),
  );
  return { ...hook, socket };
}

function gameOf(result: { current: ReturnType<typeof useTeamLink> }) {
  const { game } = result.current;
  if (!game) throw new Error('Expected a joined game');
  return game;
}

describe('useTeamLink: adapter edges', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockToast.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the join form from the game code, team code and name in the URL', () => {
    const { result } = renderHook(() =>
      useTeamLink('abcdef', 'QUICK-JADE-FOX', 'The Quizzards'),
    );

    expect(result.current.join).toMatchObject({
      codeInput: 'abcdef',
      teamCodeInput: 'QUICK-JADE-FOX',
      nameInput: 'The Quizzards',
      activeJoinCode: 'abcdef',
    });
  });

  it('types into the name, game code and team code fields', () => {
    const { result } = renderHook(() => useTeamLink(''));

    act(() => {
      result.current.join.setNameInput('Quizzards');
      result.current.join.setCodeInput('abcdef');
      result.current.join.setTeamCodeInput('QUICK-JADE-FOX');
    });

    expect(result.current.join).toMatchObject({
      nameInput: 'Quizzards',
      codeInput: 'abcdef',
      teamCodeInput: 'QUICK-JADE-FOX',
    });
  });

  it('stops the browser submitting the join form itself', () => {
    const { result } = renderHook(() => useTeamLink(''));
    const event = submitEvent();

    act(() => result.current.join.handleJoin(event));

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  describe('toasts', () => {
    it('keeps a bonus award on screen for the long award duration, with or without points', () => {
      const { socket } = renderPlayingTeam();

      act(() =>
        socket.trigger(SOCKET_EVENTS.BONUS_AWARDED, {
          category: 'selfie',
          points: 2,
        }),
      );
      act(() =>
        socket.trigger(SOCKET_EVENTS.BONUS_AWARDED, {
          category: 'shot',
          points: 0,
        }),
      );

      expect(mockToastSuccess).toHaveBeenCalledWith(expect.any(String), {
        duration: BONUS_AWARD_TOAST_DURATION_MS,
      });
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), {
        duration: BONUS_AWARD_TOAST_DURATION_MS,
      });
    });

    it('gives a joker change toast its own duration', () => {
      const { socket } = renderPlayingTeam();

      act(() =>
        socket.trigger(SOCKET_EVENTS.TEAM_JOKER_SYNCED, {
          joker: { roundId: 12, source: 'drawn' },
        }),
      );

      expect(mockToast).toHaveBeenCalledWith(expect.any(String), {
        duration: 6000,
      });
    });
  });

  describe('the answer confirmation timer', () => {
    it('is stopped by the acknowledgement, so a confirmed answer never forces a reconnect', async () => {
      vi.useFakeTimers();
      const { result, socket } = renderPlayingTeam();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = gameOf(result).submitAnswer(21, 31, 'Banana');
      });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.SUBMIT_ANSWER));
      await pending;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SUBMIT_CONFIRM_TIMEOUT_MS * 2);
      });

      expect(socket.connect).not.toHaveBeenCalled();
    });

    it('does not fire after the phone leaves the page', async () => {
      vi.useFakeTimers();
      const { result, socket, unmount } = renderPlayingTeam();
      act(() => {
        void gameOf(result).submitAnswer(21, 31, 'Banana');
      });

      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SUBMIT_CONFIRM_TIMEOUT_MS * 2);
      });

      expect(socket.connect).not.toHaveBeenCalled();
    });
  });

  describe('the rejoin retry timer', () => {
    function refusedRejoin() {
      window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
      window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
      window.localStorage.setItem('campus-pubquiz-team-token', 'token-1');
      const hook = renderHook(() => useTeamLink(''));
      const socket = latestSocket();
      act(() => socket.serverConnects());
      return { ...hook, socket };
    }

    it('is cancelled when the phone leaves the page', async () => {
      vi.useFakeTimers();
      const { socket, unmount } = refusedRejoin();
      await act(async () =>
        socket.reject(
          SOCKET_EVENTS.JOIN_PLAYERS,
          `"The Quizzards" ${SEAT_TAKEN_REFUSAL_MARKER}`,
        ),
      );
      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('replaces a pending retry when a newer connection is refused too, leaving no stale timer', async () => {
      vi.useFakeTimers();
      const { socket, unmount } = refusedRejoin();
      const refusal = `"The Quizzards" ${SEAT_TAKEN_REFUSAL_MARKER}`;
      await act(async () => socket.reject(SOCKET_EVENTS.JOIN_PLAYERS, refusal));
      act(() => socket.serverDisconnects('transport close'));
      act(() => socket.serverConnects());
      await act(async () => socket.reject(SOCKET_EVENTS.JOIN_PLAYERS, refusal));

      expect(socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS)).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('fires once after the retry delay', async () => {
      vi.useFakeTimers();
      const { socket } = refusedRejoin();
      await act(async () =>
        socket.reject(
          SOCKET_EVENTS.JOIN_PLAYERS,
          `"The Quizzards" ${SEAT_TAKEN_REFUSAL_MARKER}`,
        ),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(JOIN_RETRY_DELAY_MS);
      });

      expect(socket.emitsOf(SOCKET_EVENTS.JOIN_PLAYERS)).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('what a new identity wipes', () => {
    it('forgets the questions and the team data of the game it leaves', () => {
      const { result, socket } = renderPlayingTeam();
      act(() =>
        socket.trigger(SOCKET_EVENTS.STATE_UPDATED, {
          progress: { status: 'lobby' },
          blockQuestions: [{ id: 5 }],
        }),
      );
      expect(gameOf(result).seenQuestions).toEqual({ 5: { id: 5 } });
      expect(gameOf(result).myAnswers).toEqual({ 20: 'Paris' });

      const next = joinGame({ result } as Hook, 'Another Team', 'zzzzzz');
      act(() => next.serverConnects());
      act(() =>
        next.trigger(SOCKET_EVENTS.STATE_UPDATED, {
          progress: { status: 'lobby' },
          blockQuestions: [{ id: 6 }],
        }),
      );

      expect(next).not.toBe(socket);
      expect(gameOf(result).seenQuestions).toEqual({ 6: { id: 6 } });
      expect(gameOf(result).myAnswers).toEqual({});
      expect(result.current.join.team).toBeNull();
    });

    it('does not wipe the first join of a page that opened with a game code', () => {
      const { result } = renderHook(() => useTeamLink('ABCDEF'));
      const socket = latestSocket();
      act(() => socket.serverConnects());
      act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
      act(() =>
        socket.trigger(
          SOCKET_EVENTS.STATE_SYNC,
          roomView(SOCKET_ROOMS.PLAYERS, {}),
        ),
      );

      // Counts join payloads: the page's own mount is not an identity change.
      expect(gameOf(result).roundRatingsEpoch).toBe(1);
    });

    it('does not count logging out as a second wipe, and keeps the questions the screen still shows', () => {
      const { result, socket } = renderPlayingTeam();
      act(() =>
        socket.trigger(SOCKET_EVENTS.STATE_UPDATED, {
          progress: { status: 'lobby' },
          blockQuestions: [{ id: 5 }],
        }),
      );
      const epochBefore = gameOf(result).roundRatingsEpoch;

      act(() => result.current.join.handleLogOut());

      expect(gameOf(result).roundRatingsEpoch).toBe(epochBefore + 1);
      expect(gameOf(result).seenQuestions).toEqual({ 5: { id: 5 } });
    });
  });

  describe('the join guard', () => {
    it('is released when the server refuses the connection, so the next tap opens a new one', () => {
      const { result } = renderHook(() => useTeamLink(''));
      const socket = joinGame({ result } as Hook, 'The Quizzards', 'abcdef');

      act(() => socket.serverDisconnects('io server disconnect'));
      act(() => result.current.join.handleJoin(submitEvent()));

      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it('is not released by a connection that merely recovered while the join is unanswered', () => {
      const { result } = renderHook(() => useTeamLink(''));
      const socket = joinGame({ result } as Hook, 'The Quizzards', 'abcdef');
      act(() => socket.serverConnects());
      act(() => socket.serverDisconnects('transport close'));
      act(() => socket.serverConnects());
      act(() =>
        socket.trigger(
          SOCKET_EVENTS.STATE_SYNC,
          roomView(SOCKET_ROOMS.PLAYERS, {}),
        ),
      );

      act(() => result.current.join.handleJoin(submitEvent()));

      expect(mockIo).toHaveBeenCalledTimes(1);
    });
  });

  describe('the reconnecting bar', () => {
    it('stays hidden while a join refusal is on screen', async () => {
      const { result } = renderHook(() => useTeamLink(''));
      const socket = joinGame({ result } as Hook, 'The Quizzards', 'abcdef');
      act(() => socket.serverConnects());
      await act(async () =>
        socket.reject(SOCKET_EVENTS.JOIN_PLAYERS, 'Unknown game'),
      );

      act(() => socket.serverDisconnects('transport close'));

      expect(result.current.join.connectionError).toBe('Unknown game');
      expect(result.current.join.isReconnecting).toBe(false);
    });

    it('stays hidden while the kick notice is on screen', () => {
      const { result, socket } = renderPlayingTeam();
      act(() => socket.trigger(SOCKET_EVENTS.TEAM_KICKED));

      act(() => socket.serverDisconnects('transport close'));

      expect(result.current.join.connectionError).toContain('removed');
      expect(result.current.join.isReconnecting).toBe(false);
    });
  });

  describe('acknowledgements from the server', () => {
    it('records a round rating only once the server accepts it', async () => {
      const { result, socket } = renderPlayingTeam();

      let rated!: Promise<AckResult>;
      act(() => {
        rated = gameOf(result).rateRound(11, 4);
      });
      await act(async () => socket.reject(SOCKET_EVENTS.RATE_ROUND, 'Closed'));
      await rated;

      expect(gameOf(result).myRoundRatings).toEqual({});
    });

    it('records the comment and topics only once the server accepts them', async () => {
      const { result, socket } = renderPlayingTeam();

      let refused!: Promise<AckResult>;
      act(() => {
        refused = gameOf(result).sendFeedback({
          comment: 'Great',
          topics: ['Films'],
        });
      });
      await act(async () => socket.reject(SOCKET_EVENTS.SEND_FEEDBACK, 'No'));
      await refused;
      expect(gameOf(result).myFeedback).toEqual({ comment: '', topics: [] });

      let accepted!: Promise<AckResult>;
      act(() => {
        accepted = gameOf(result).sendFeedback({
          comment: 'Great',
          topics: ['Films'],
        });
      });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.SEND_FEEDBACK));
      await accepted;
      expect(gameOf(result).myFeedback).toEqual({
        comment: 'Great',
        topics: ['Films'],
      });
    });
  });

  it('feeds the first view into the seen questions as well as later updates', () => {
    const { result, socket } = renderPlayingTeam();

    act(() =>
      socket.trigger(SOCKET_EVENTS.STATE_SYNC, {
        progress: { status: 'lobby' },
        blockQuestions: [{ id: 7 }],
      }),
    );

    expect(gameOf(result).seenQuestions).toEqual({ 7: { id: 7 } });
  });
});
