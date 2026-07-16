import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useGameSocket } from './use-game-socket';

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
    trigger(event: string, payload: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
  };
}

const fakeSocket = createFakeSocket();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

describe('useGameSocket', () => {
  beforeEach(() => {
    fakeSocket.on.mockClear();
    fakeSocket.emit.mockClear();
    fakeSocket.disconnect.mockClear();
  });

  it('starts with no snapshot and no error', () => {
    const { result } = renderHook(() => useGameSocket('display'));
    expect(result.current.snapshot).toBeNull();
    expect(result.current.connectionError).toBeNull();
  });

  it('adopts the snapshot sent on STATE_SYNC', async () => {
    const { result } = renderHook(() => useGameSocket('display'));
    const snapshot = { progress: { status: 'lobby', roundIndex: 0, questionIndex: 0, isLeaderboardVisible: false }, currentQuestion: null };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot);
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
  });

  it('adopts the snapshot sent on STATE_UPDATED', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const snapshot = {
      progress: { status: 'question_open', roundIndex: 0, questionIndex: 0, isLeaderboardVisible: false },
      currentQuestion: { id: 'r1q1', type: 'free_text' as const, prompt: 'Q?', points: 1 },
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_UPDATED, snapshot);
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
  });

  it('surfaces a server exception as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));

    act(() => {
      fakeSocket.trigger('exception', { message: 'Only admin clients may perform game actions' });
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe('Only admin clients may perform game actions'),
    );
  });

  it('sendAction emits an ADMIN_ACTION event with the action payload', () => {
    const { result } = renderHook(() => useGameSocket('admin'));

    act(() => {
      result.current.sendAction('START_QUIZ');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ADMIN_ACTION, { action: 'START_QUIZ' });
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderHook(() => useGameSocket('display'));
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it('joinTeam emits a JOIN_PLAYERS event with the team name and token', () => {
    const { result } = renderHook(() => useGameSocket('players'));

    act(() => {
      result.current.joinTeam('The Quizzards', 'existing-token');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.JOIN_PLAYERS, {
      teamName: 'The Quizzards',
      teamToken: 'existing-token',
    });
  });

  it('adopts the joined team identity on JOIN_ACCEPTED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: 'team-1',
        teamName: 'The Quizzards',
        teamToken: 'team-token-1',
      });
    });

    await waitFor(() =>
      expect(result.current.team).toEqual({
        teamId: 'team-1',
        teamName: 'The Quizzards',
        teamToken: 'team-token-1',
      }),
    );
  });

  it('submitAnswer emits a SUBMIT_ANSWER event with questionId, teamId, and value', () => {
    const { result } = renderHook(() => useGameSocket('players'));

    act(() => {
      result.current.submitAnswer('r1q1', 'team-1', 'Banana');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SUBMIT_ANSWER, {
      questionId: 'r1q1',
      teamId: 'team-1',
      value: 'Banana',
    });
  });

  it('adopts the live answers list on ANSWERS_UPDATED', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const payload = {
      questionId: 'r1q1',
      answers: [
        {
          answerId: 'answer-1',
          teamId: 'team-1',
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: null,
        },
      ],
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, payload);
    });

    await waitFor(() => expect(result.current.liveAnswers).toEqual(payload));
  });

  it('gradeAnswer emits a GRADE_ANSWER event with answerId and pointsAwarded', () => {
    const { result } = renderHook(() => useGameSocket('admin'));

    act(() => {
      result.current.gradeAnswer('answer-1', 2);
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.GRADE_ANSWER, {
      answerId: 'answer-1',
      pointsAwarded: 2,
    });
  });
});
