import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import {
  SUBMIT_CONFIRM_TIMEOUT_MS,
  useGameSocket,
} from '@/app/lib/use-game-socket';

type Handler = (...args: unknown[]) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler[]>();
  let connectCount = 0;
  const socket = {
    id: undefined as string | undefined,
    on: vi.fn((event: string, handler: Handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    trigger(event: string, payload?: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
    /** Simulates socket.io handing out a fresh socket id on (re)connect. */
    simulateConnect() {
      connectCount += 1;
      socket.id = `socket-${connectCount}`;
      socket.trigger('connect');
    },
  };
  return socket;
}

const { mockIo, mockToastError } = vi.hoisted(() => ({
  mockIo: vi.fn(() => createFakeSocket()),
  mockToastError: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('sonner', () => ({ toast: { error: mockToastError } }));

function getFakeSocket() {
  return mockIo.mock.results[mockIo.mock.results.length - 1]
    ?.value as ReturnType<typeof createFakeSocket>;
}

const JOIN_ACCEPTED_PAYLOAD = {
  teamId: 31,
  teamName: 'The Quizzards',
  teamToken: 'team-token-1',
  teamCode: 'team-code-1',
  answers: [],
  bonusAwards: [],
};

function renderLinkedPlayer() {
  const hook = renderHook(() => useGameSocket('players'));
  const fakeSocket = getFakeSocket();
  act(() => {
    fakeSocket.simulateConnect();
    fakeSocket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD);
  });
  return { ...hook, fakeSocket };
}

describe('useGameSocket — player reconnect handling', () => {
  beforeEach(() => {
    mockIo.mockClear();
    mockToastError.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the team linked once JOIN_ACCEPTED arrives and unlinked on disconnect', () => {
    const { result, fakeSocket } = renderLinkedPlayer();
    expect(result.current.isTeamLinked).toBe(true);

    act(() => {
      fakeSocket.trigger('disconnect', 'transport close');
    });

    expect(result.current.isTeamLinked).toBe(false);
  });

  it('tells the player it is reconnecting after an unexpected disconnect', () => {
    const { result, fakeSocket } = renderLinkedPlayer();

    act(() => {
      fakeSocket.trigger('disconnect', 'transport close');
    });

    expect(result.current.connectionError).toBe(
      'Connection lost — reconnecting…',
    );
  });

  it('does not send an answer while the team is not linked, and says why', () => {
    const { result, fakeSocket } = renderLinkedPlayer();
    act(() => {
      fakeSocket.trigger('disconnect', 'transport close');
    });
    fakeSocket.emit.mockClear();

    act(() => {
      result.current.submitAnswer(21, 31, 'Banana');
    });

    expect(fakeSocket.emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.SUBMIT_ANSWER,
      expect.anything(),
    );
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringMatching(/not connected/i),
    );
  });

  it('forces a reconnect when a submitted answer is never confirmed', () => {
    const { result, fakeSocket } = renderLinkedPlayer();

    act(() => {
      result.current.submitAnswer(21, 31, 'Banana');
    });
    act(() => {
      vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
    });

    expect(fakeSocket.disconnect).toHaveBeenCalled();
    expect(fakeSocket.connect).toHaveBeenCalled();
    expect(result.current.isTeamLinked).toBe(false);
    expect(result.current.connectionError).toBe(
      'Connection lost — reconnecting…',
    );
  });

  it('does not reconnect once the answer is confirmed with ANSWER_RECEIVED', () => {
    const { result, fakeSocket } = renderLinkedPlayer();

    act(() => {
      result.current.submitAnswer(21, 31, 'Banana');
      fakeSocket.trigger(SOCKET_EVENTS.ANSWER_RECEIVED, {
        questionId: 21,
        teamId: 31,
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: 0,
        gradedAt: null,
      });
    });
    act(() => {
      vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
    });

    expect(fakeSocket.connect).not.toHaveBeenCalled();
  });

  it('does not reconnect when the server answers the submit with an exception', () => {
    const { result, fakeSocket } = renderLinkedPlayer();

    act(() => {
      result.current.submitAnswer(21, 31, 'Banana');
      fakeSocket.trigger('exception', {
        message: 'Answers are locked for this question',
      });
    });
    act(() => {
      vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
    });

    expect(fakeSocket.connect).not.toHaveBeenCalled();
  });

  it('names the socket the team was linked on when rejoining after a reconnect', () => {
    const { result, fakeSocket } = renderLinkedPlayer();
    act(() => {
      fakeSocket.trigger('disconnect', 'transport close');
      fakeSocket.simulateConnect();
    });

    act(() => {
      result.current.joinTeam('The Quizzards', { joinCode: 'ABCDEF' });
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_PLAYERS,
      expect.objectContaining({ previousSocketId: 'socket-1' }),
    );
  });

  it('resends an unconfirmed answer once the team is linked again', () => {
    const { result, fakeSocket } = renderLinkedPlayer();
    act(() => {
      result.current.submitAnswer(21, 31, 'Banana');
    });
    act(() => {
      vi.advanceTimersByTime(SUBMIT_CONFIRM_TIMEOUT_MS);
    });
    fakeSocket.emit.mockClear();

    act(() => {
      fakeSocket.simulateConnect();
      fakeSocket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, JOIN_ACCEPTED_PAYLOAD);
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SUBMIT_ANSWER, {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });
  });
});
