import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS, type AckResult } from '@campus-pubquiz/types';
import {
  SUBMIT_CONFIRM_TIMEOUT_MS,
  usePlayerGame,
} from '@/app/lib/use-player-game';
import {
  NOT_CONNECTED_MESSAGE,
  RECONNECTING_MESSAGE,
} from '@/app/lib/use-game-connection';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

const { mockIo, mockToastError } = vi.hoisted(() => ({
  mockIo: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('sonner', () => ({ toast: { error: mockToastError } }));

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

const JOIN_ACCEPTED_PAYLOAD = {
  teamId: 31,
  teamName: 'The Quizzards',
  teamToken: 'team-token-1',
  teamCode: 'team-code-1',
  answers: [
    {
      questionId: 20,
      value: 'Paris',
      pointsAwarded: 2,
      gradedAt: '2026-10-01T10:00:00.000Z',
      verdict: 'correct',
    },
  ],
  bonusAwards: [{ id: 1, category: 'shot', points: 1, reason: null }],
  roundRatings: [{ roundId: 11, stars: 4 }],
};
const LOCKED_MESSAGE = 'Answers are locked for this question';

function renderConnectedPlayer() {
  const hook = renderHook(() => usePlayerGame(true, 'ABCDEF'));
  const socket = latestSocket();
  act(() => socket.serverConnects());
  return { ...hook, socket };
}

function renderLinkedPlayer() {
  const hook = renderConnectedPlayer();
  act(() =>
    hook.socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD),
  );
  return hook;
}

function submit(result: {
  current: ReturnType<typeof usePlayerGame>;
}): Promise<AckResult> {
  let pending!: Promise<AckResult>;
  act(() => {
    pending = result.current.submitAnswer(21, 31, 'Banana');
  });
  return pending;
}

describe('usePlayerGame', () => {
  beforeEach(() => {
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockToastError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('joining', () => {
    it('emits the join and resolves to the acknowledgement', async () => {
      const { result, socket } = renderConnectedPlayer();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.joinTeam('The Quizzards', {
          teamToken: 'token',
          teamCode: 'code',
          joinCode: 'ABCDEF',
        });
      });
      expect(socket.lastEmitOf(SOCKET_EVENTS.JOIN_PLAYERS).payload).toEqual({
        teamName: 'The Quizzards',
        teamToken: 'token',
        teamCode: 'code',
        joinCode: 'ABCDEF',
      });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.JOIN_PLAYERS));

      await expect(pending).resolves.toEqual({ success: true });
    });

    it('resolves a rejected join to its reason without touching the connection error or toasting', async () => {
      const { result, socket } = renderConnectedPlayer();
      const reason = 'Team name "The Quizzards" is already registered';

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.joinTeam('The Quizzards');
      });
      await act(async () => socket.reject(SOCKET_EVENTS.JOIN_PLAYERS, reason));

      await expect(pending).resolves.toEqual({ success: false, error: reason });
      expect(result.current.connectionError).toBeNull();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('names the socket the team was linked on when rejoining after a reconnect', () => {
      const { result, socket } = renderConnectedPlayer();
      socket.id = 'socket-1';
      act(() =>
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD),
      );
      act(() => {
        socket.serverDisconnects();
        socket.id = 'socket-2';
        socket.serverConnects();
      });

      act(() => {
        void result.current.joinTeam('The Quizzards', { joinCode: 'ABCDEF' });
      });

      expect(
        socket.lastEmitOf(SOCKET_EVENTS.JOIN_PLAYERS).payload,
      ).toMatchObject({ previousSocketId: 'socket-1' });
    });

    it('fails a join fast while disconnected', async () => {
      const { result, socket } = renderConnectedPlayer();
      act(() => socket.serverDisconnects());

      await expect(result.current.joinTeam('The Quizzards')).resolves.toEqual({
        success: false,
        error: NOT_CONNECTED_MESSAGE,
      });
    });
  });

  describe('team state', () => {
    it('exposes the team, answers, grades and bonus awards once linked', () => {
      const { result } = renderLinkedPlayer();

      expect(result.current.team).toEqual(JOIN_ACCEPTED_PAYLOAD);
      expect(result.current.isTeamLinked).toBe(true);
      expect(result.current.myAnswers).toEqual({ 20: 'Paris' });
      expect(result.current.myAnswerGrades).toEqual({
        20: {
          pointsAwarded: 2,
          gradedAt: '2026-10-01T10:00:00.000Z',
          verdict: 'correct',
        },
      });
      expect(result.current.myBonusAwards).toEqual(
        JOIN_ACCEPTED_PAYLOAD.bonusAwards,
      );
    });

    it('restores the saved round ratings from the join payload, replacing what an earlier join held', () => {
      const { result, socket } = renderLinkedPlayer();
      expect(result.current.myRoundRatings).toEqual({ 11: 4 });

      act(() =>
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
          ...JOIN_ACCEPTED_PAYLOAD,
          roundRatings: [{ roundId: 12, stars: 2 }],
        }),
      );

      expect(result.current.myRoundRatings).toEqual({ 12: 2 });
    });

    it('marks the team unlinked on disconnect and tells the player it is reconnecting', () => {
      const { result, socket } = renderLinkedPlayer();

      act(() => socket.serverDisconnects());

      expect(result.current.isTeamLinked).toBe(false);
      expect(result.current.connectionError).toBe(RECONNECTING_MESSAGE);
    });

    it('records a saved answer and its auto-graded points from ANSWER_RECEIVED', () => {
      const { result, socket } = renderLinkedPlayer();

      act(() =>
        socket.trigger(SOCKET_EVENTS.ANSWER_RECEIVED, {
          questionId: 21,
          teamId: 31,
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: 3,
          gradedAt: '2026-10-01T10:05:00.000Z',
          verdict: 'correct',
        }),
      );

      expect(result.current.myAnswers[21]).toBe('Banana');
      expect(result.current.myAnswerGrades[21]).toEqual({
        pointsAwarded: 3,
        gradedAt: '2026-10-01T10:05:00.000Z',
        verdict: 'correct',
      });
    });

    it('replaces answers and grades wholesale on TEAM_ANSWERS_SYNCED and appends pushed bonus awards', () => {
      const { result, socket } = renderLinkedPlayer();

      act(() => {
        socket.trigger(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, {
          answers: [
            {
              questionId: 22,
              value: 'Rome',
              pointsAwarded: 0,
              gradedAt: null,
              verdict: null,
            },
          ],
        });
        socket.trigger(SOCKET_EVENTS.BONUS_AWARDED, {
          id: 2,
          category: 'custom',
          points: 2,
          reason: 'Best name',
        });
      });

      expect(result.current.myAnswers).toEqual({ 22: 'Rome' });
      expect(result.current.myAnswerGrades).toEqual({});
      expect(result.current.myBonusAwards).toHaveLength(2);
    });

    it('raises the kicked and session-closed signals', () => {
      const { result, socket } = renderLinkedPlayer();
      expect(result.current.kicked).toBe(false);
      expect(result.current.sessionClosed).toBeNull();

      act(() => {
        socket.trigger(SOCKET_EVENTS.TEAM_KICKED);
        socket.trigger(SOCKET_EVENTS.SESSION_CLOSED, { joinCode: 'ABCDEF' });
      });

      expect(result.current.kicked).toBe(true);
      expect(result.current.sessionClosed).toBe('ABCDEF');
    });

    it('clears the team when the session code changes', () => {
      const hook = renderHook(({ code }) => usePlayerGame(true, code), {
        initialProps: { code: 'ABCDEF' },
      });
      const socket = latestSocket();
      act(() => socket.serverConnects());
      act(() =>
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD),
      );
      expect(hook.result.current.team).not.toBeNull();

      hook.rerender({ code: 'ZZZZZZ' });

      expect(hook.result.current.team).toBeNull();
      expect(hook.result.current.myAnswers).toEqual({});
      expect(hook.result.current.isTeamLinked).toBe(false);
    });
  });

  describe('seen questions', () => {
    it('accumulates questions across blocks, letting a later sighting win', () => {
      const { result, socket } = renderConnectedPlayer();
      const question = (id: number, text: string) => ({ id, question: text });

      act(() =>
        socket.trigger(SOCKET_EVENTS.STATE_SYNC, {
          progress: { status: 'question_open' },
          blockQuestions: [question(1, 'one'), question(2, 'two')],
        }),
      );
      act(() =>
        socket.trigger(SOCKET_EVENTS.STATE_UPDATED, {
          progress: { status: 'question_open' },
          blockQuestions: [question(3, 'three')],
          revealQuestions: [question(2, 'two, revealed')],
        }),
      );

      expect(Object.keys(result.current.seenQuestions).sort()).toEqual([
        '1',
        '2',
        '3',
      ]);
      expect(result.current.seenQuestions[2]).toMatchObject({
        question: 'two, revealed',
      });
    });
  });

  describe('submitting an answer', () => {
    it('emits the answer and resolves once the server acknowledges it, without reconnecting', async () => {
      vi.useFakeTimers();
      const { result, socket } = renderLinkedPlayer();

      const pending = submit(result);
      expect(socket.lastEmitOf(SOCKET_EVENTS.SUBMIT_ANSWER).payload).toEqual({
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.SUBMIT_ANSWER));
      act(() => {
        vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
      });

      await expect(pending).resolves.toEqual({ success: true });
      expect(socket.connect).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('shows a rejection, drops the pending answer and does not reconnect', async () => {
      vi.useFakeTimers();
      const { result, socket } = renderLinkedPlayer();

      const pending = submit(result);
      await act(async () =>
        socket.reject(SOCKET_EVENTS.SUBMIT_ANSWER, LOCKED_MESSAGE),
      );
      act(() => {
        vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
      });

      await expect(pending).resolves.toEqual({
        success: false,
        error: LOCKED_MESSAGE,
      });
      expect(mockToastError).toHaveBeenCalledWith(LOCKED_MESSAGE);
      expect(result.current.connectionError).toBeNull();
      expect(socket.connect).not.toHaveBeenCalled();

      // The rejected answer is not resent after a later rejoin.
      act(() => {
        socket.serverDisconnects();
        socket.serverConnects();
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD);
      });
      expect(socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER)).toHaveLength(1);
    });

    it('forces a fresh connection when the answer is never acknowledged, then resends it after the rejoin', () => {
      vi.useFakeTimers();
      const { result, socket } = renderLinkedPlayer();
      void submit(result);

      act(() => {
        vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
      });

      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.connect).toHaveBeenCalled();
      expect(result.current.isTeamLinked).toBe(false);
      expect(result.current.connectionError).toBe(RECONNECTING_MESSAGE);

      act(() => {
        socket.serverConnects();
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD);
      });

      const sends = socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER);
      expect(sends).toHaveLength(2);
      expect(sends[1].payload).toEqual({
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      });
    });

    it('keeps an answer that never left the socket pending without forcing a reconnect', async () => {
      vi.useFakeTimers();
      const { result, socket } = renderLinkedPlayer();
      // The transport dropped but its disconnect event hasn't arrived yet.
      socket.connected = false;

      const outcome = await submit(result);
      act(() => {
        vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
      });

      expect(outcome).toEqual({ success: false, error: NOT_CONNECTED_MESSAGE });
      expect(socket.connect).not.toHaveBeenCalled();

      // It is resent once the team is linked again.
      act(() => {
        socket.serverConnects();
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD);
      });
      expect(socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER)).toHaveLength(1);
    });

    it('refuses while unlinked with the "not connected" toast and sends nothing', async () => {
      const { result, socket } = renderLinkedPlayer();
      act(() => socket.serverDisconnects());

      const outcome = await submit(result);

      expect(outcome).toEqual({ success: false, error: NOT_CONNECTED_MESSAGE });
      expect(mockToastError).toHaveBeenCalledWith(NOT_CONNECTED_MESSAGE);
      expect(socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER)).toHaveLength(0);
    });
  });

  describe('leaving and showdown guesses', () => {
    it('emits the leave request and resolves to its acknowledgement', async () => {
      const { result, socket } = renderLinkedPlayer();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.leaveSession(31);
      });
      expect(socket.lastEmitOf(SOCKET_EVENTS.LEAVE_SESSION).payload).toEqual({
        teamId: 31,
      });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.LEAVE_SESSION));

      await expect(pending).resolves.toEqual({ success: true });
    });

    it('emits a showdown guess and resolves on success', async () => {
      const { result, socket } = renderLinkedPlayer();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.submitShowdownGuess(4, 31, '42');
      });
      expect(
        socket.lastEmitOf(SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS).payload,
      ).toEqual({ showdownRoundId: 4, teamId: 31, value: '42' });
      await act(async () =>
        socket.acknowledge(SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS),
      );

      await expect(pending).resolves.toEqual({ success: true });
    });

    it('tells the team why a showdown guess was rejected, without a connection error', async () => {
      const { result, socket } = renderLinkedPlayer();
      const reason = 'This showdown round is already closed';

      act(() => {
        void result.current.submitShowdownGuess(4, 31, '42');
      });
      await act(async () =>
        socket.reject(SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS, reason),
      );

      expect(mockToastError).toHaveBeenCalledWith(reason);
      expect(result.current.connectionError).toBeNull();
    });
  });

  describe('rating a round', () => {
    it('emits the rating and resolves to its acknowledgement', async () => {
      const { result, socket } = renderLinkedPlayer();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.rateRound(12, 5);
      });
      expect(socket.lastEmitOf(SOCKET_EVENTS.RATE_ROUND).payload).toEqual({
        roundId: 12,
        stars: 5,
      });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.RATE_ROUND));

      await expect(pending).resolves.toEqual({ success: true });
    });

    it('keeps an acknowledged rating in myRoundRatings, so a remounted card still shows it', async () => {
      const { result, socket } = renderLinkedPlayer();

      act(() => {
        void result.current.rateRound(12, 5);
      });
      expect(result.current.myRoundRatings).toEqual({ 11: 4 });
      await act(async () => socket.acknowledge(SOCKET_EVENTS.RATE_ROUND));

      expect(result.current.myRoundRatings).toEqual({ 11: 4, 12: 5 });
    });

    it('does not keep a refused rating, and counts each join payload', async () => {
      const { result, socket } = renderLinkedPlayer();
      const epochAfterFirstJoin = result.current.roundRatingsEpoch;

      act(() => {
        void result.current.rateRound(12, 5);
      });
      await act(async () =>
        socket.reject(SOCKET_EVENTS.RATE_ROUND, 'Not open'),
      );
      expect(result.current.myRoundRatings).toEqual({ 11: 4 });

      act(() =>
        socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD),
      );
      expect(result.current.roundRatingsEpoch).toBe(epochAfterFirstJoin + 1);
    });

    it('resolves to the refusal without toasting or a connection error, since the card shows it', async () => {
      const { result, socket } = renderLinkedPlayer();
      const reason = "This round can't be rated right now";

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.rateRound(12, 5);
      });
      await act(async () => socket.reject(SOCKET_EVENTS.RATE_ROUND, reason));

      await expect(pending).resolves.toEqual({ success: false, error: reason });
      expect(mockToastError).not.toHaveBeenCalled();
      expect(result.current.connectionError).toBeNull();
    });
  });

  it('exposes no admin-only members', () => {
    const { result } = renderConnectedPlayer();

    expect(Object.keys(result.current).sort()).toEqual(
      [
        'connectionError',
        'isTeamLinked',
        'joinTeam',
        'kicked',
        'leaveSession',
        'myAnswerGrades',
        'myAnswers',
        'myBonusAwards',
        'myRoundRatings',
        'rateRound',
        'reconnectedAt',
        'roundRatingsEpoch',
        'seenQuestions',
        'sessionClosed',
        'snapshot',
        'submitAnswer',
        'submitShowdownGuess',
        'team',
      ].sort(),
    );
  });
});
