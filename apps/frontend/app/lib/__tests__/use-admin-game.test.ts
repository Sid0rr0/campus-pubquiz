import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS, type AckResult } from '@campus-pubquiz/types';
import { useAdminGame } from '@/app/lib/use-admin-game';
import { ACK_TIMEOUT_MS } from '@/app/lib/use-game-connection';
import { NOT_CONNECTED_MESSAGE } from '@/app/lib/connection-messages';
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

const SNAPSHOT = { joinCode: 'TESTCODE', progress: { status: 'lobby' } };
const BONUS_CAP_MESSAGE = 'This team has reached the "shot" bonus cap';

function renderConnectedAdmin() {
  const hook = renderHook(() => useAdminGame(true, 'TESTCODE'));
  const socket = latestSocket();
  act(() => socket.serverConnects());
  return { ...hook, socket };
}

describe('useAdminGame', () => {
  beforeEach(() => {
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockToastError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('actions', () => {
    const actions: Array<{
      name: string;
      event: string;
      payload: unknown;
      call: (game: ReturnType<typeof useAdminGame>) => Promise<AckResult>;
    }> = [
      {
        name: 'sendAction',
        event: SOCKET_EVENTS.ADMIN_ACTION,
        payload: { action: 'START_QUIZ' },
        call: (game) => game.sendAction('START_QUIZ'),
      },
      {
        name: 'gradeAnswer',
        event: SOCKET_EVENTS.GRADE_ANSWER,
        payload: { answerId: 1, pointsAwarded: 2 },
        call: (game) => game.gradeAnswer(1, 2),
      },
      {
        name: 'kickTeam',
        event: SOCKET_EVENTS.KICK_TEAM,
        payload: { teamId: 7 },
        call: (game) => game.kickTeam(7),
      },
      {
        name: 'awardBonus',
        event: SOCKET_EVENTS.AWARD_BONUS,
        payload: { teamId: 31, category: 'custom', points: 3, reason: 'Name' },
        call: (game) => game.awardBonus(31, 'custom', 3, 'Name'),
      },
      {
        name: 'setBreakEndTime',
        event: SOCKET_EVENTS.SET_BREAK_END_TIME,
        payload: { breakEndsAt: 1234 },
        call: (game) => game.setBreakEndTime(1234),
      },
      {
        name: 'setDisplayTextScale',
        event: SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE,
        payload: { displayTextScale: 1.5 },
        call: (game) => game.setDisplayTextScale(1.5),
      },
      {
        name: 'createShowdownRound',
        event: SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND,
        payload: { question: 'How many?', answer: '42', points: 1 },
        call: (game) => game.createShowdownRound('How many?', '42', 1),
      },
    ];

    it.each(actions)(
      '$name emits its payload and resolves to the acknowledgement',
      async ({ event, payload, call }) => {
        const { result, socket } = renderConnectedAdmin();

        let pending!: Promise<AckResult>;
        act(() => {
          pending = call(result.current);
        });
        expect(socket.lastEmitOf(event).payload).toEqual(payload);
        await act(async () => socket.acknowledge(event));

        await expect(pending).resolves.toEqual({
          success: true,
          data: undefined,
        });
        expect(mockToastError).not.toHaveBeenCalled();
      },
    );

    it.each(actions)(
      '$name toasts a rejection without touching the connection error',
      async ({ event, call }) => {
        const { result, socket } = renderConnectedAdmin();

        let pending!: Promise<AckResult>;
        act(() => {
          pending = call(result.current);
        });
        await act(async () => socket.reject(event, 'Rejected for a reason'));

        await expect(pending).resolves.toEqual({
          success: false,
          error: 'Rejected for a reason',
        });
        expect(mockToastError).toHaveBeenCalledWith('Rejected for a reason');
        expect(result.current.connectionError).toBeNull();
      },
    );

    it('toasts every repeat of an identical rejection', async () => {
      const { result, socket } = renderConnectedAdmin();

      for (let attempt = 0; attempt < 2; attempt++) {
        act(() => {
          void result.current.awardBonus(31, 'shot', 1);
        });
        await act(async () =>
          socket.reject(SOCKET_EVENTS.AWARD_BONUS, BONUS_CAP_MESSAGE),
        );
      }

      expect(mockToastError).toHaveBeenCalledTimes(2);
    });

    it('fails fast with "not connected" when the socket is disconnected', async () => {
      const { result, socket } = renderConnectedAdmin();
      act(() => socket.serverDisconnects());

      let outcome!: AckResult;
      await act(async () => {
        outcome = await result.current.kickTeam(7);
      });

      expect(outcome).toEqual({ success: false, error: NOT_CONNECTED_MESSAGE });
      expect(socket.emitsOf(SOCKET_EVENTS.KICK_TEAM)).toHaveLength(0);
      expect(mockToastError).toHaveBeenCalledWith(NOT_CONNECTED_MESSAGE);
    });

    it('resolves to "not connected" when the server never acknowledges', async () => {
      vi.useFakeTimers();
      const { result } = renderConnectedAdmin();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.kickTeam(7);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS);
      });

      await expect(pending).resolves.toEqual({
        success: false,
        error: NOT_CONNECTED_MESSAGE,
      });
    });

    it('delivers a bonus rejection to its caller when a state update arrives in flight', async () => {
      const { result, socket } = renderConnectedAdmin();

      let pending!: Promise<AckResult>;
      act(() => {
        pending = result.current.awardBonus(31, 'shot', 1);
        socket.trigger(SOCKET_EVENTS.STATE_UPDATED, SNAPSHOT);
      });
      await act(async () =>
        socket.reject(SOCKET_EVENTS.AWARD_BONUS, BONUS_CAP_MESSAGE),
      );

      await expect(pending).resolves.toEqual({
        success: false,
        error: BONUS_CAP_MESSAGE,
      });
      expect(mockToastError).toHaveBeenCalledWith(BONUS_CAP_MESSAGE);
      expect(result.current.connectionError).toBeNull();
    });
  });

  describe('connection state', () => {
    it('keeps a rejected action on a live session out of the connection error', async () => {
      const { result, socket } = renderConnectedAdmin();
      act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, SNAPSHOT));

      act(() => {
        void result.current.setDisplayTextScale(3);
      });
      await act(async () =>
        socket.reject(SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE, 'Unsupported'),
      );

      expect(result.current.snapshot).toEqual(SNAPSHOT);
      expect(result.current.connectionError).toBeNull();
    });

    it('sets the connection error only from connection problems, and clears it on state sync', () => {
      const { result, socket } = renderConnectedAdmin();

      act(() => socket.trigger('connect_error', { message: 'Refused' }));
      expect(result.current.connectionError).toBe('Refused');

      act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, SNAPSHOT));
      expect(result.current.connectionError).toBeNull();
    });

    it('records the reconnect timestamp on connect', () => {
      const { result } = renderConnectedAdmin();
      expect(result.current.reconnectedAt).not.toBeNull();
    });
  });

  describe('live answers and presenter context', () => {
    it('ignores a broadcast for a question other than the focused one', () => {
      const { result, socket } = renderConnectedAdmin();
      const focused = { questionId: 1, answers: [] };

      act(() => {
        result.current.focusAnswersQuestionId(1);
        socket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, focused);
      });
      act(() =>
        socket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, {
          questionId: 2,
          answers: [],
        }),
      );

      expect(result.current.liveAnswers).toEqual(focused);
    });

    it('folds a REST-fetched payload in through setLiveAnswers', () => {
      const { result } = renderConnectedAdmin();
      const payload = { questionId: 1, answers: [] };

      act(() => result.current.setLiveAnswers(payload as never));

      expect(result.current.liveAnswers).toEqual(payload);
    });

    it('adopts the presenter context', () => {
      const { result, socket } = renderConnectedAdmin();
      const context = { notes: 'Ask twice' };

      act(() =>
        socket.trigger(SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED, context),
      );

      expect(result.current.presenterContext).toEqual(context);
    });
  });

  describe('identity', () => {
    it('resets the snapshot, live answers and presenter context on a session change', () => {
      const { result, rerender } = renderHook(
        ({ code }) => useAdminGame(true, code),
        { initialProps: { code: 'AAAAAA' } },
      );
      const socket = latestSocket();
      act(() => {
        socket.serverConnects();
        socket.trigger(SOCKET_EVENTS.STATE_SYNC, SNAPSHOT);
        socket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, {
          questionId: 1,
          answers: [],
        });
        socket.trigger(SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED, { notes: 'x' });
      });
      expect(result.current.snapshot).not.toBeNull();

      rerender({ code: 'BBBBBB' });

      expect(result.current.snapshot).toBeNull();
      expect(result.current.liveAnswers).toBeNull();
      expect(result.current.presenterContext).toBeNull();
      expect(socket.disconnect).toHaveBeenCalled();
      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it('exposes no players-only members and no bonus-award-error value', () => {
      const { result } = renderConnectedAdmin();
      const members = Object.keys(result.current);

      for (const absent of [
        'team',
        'joinTeam',
        'submitAnswer',
        'leaveSession',
        'submitShowdownGuess',
        'myAnswers',
        'kicked',
        'isTeamLinked',
        'bonusAwardError',
      ]) {
        expect(members).not.toContain(absent);
      }
    });
  });
});
