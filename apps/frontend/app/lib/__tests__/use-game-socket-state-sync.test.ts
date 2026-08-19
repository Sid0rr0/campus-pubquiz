import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';

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

const { mockIo } = vi.hoisted(() => ({
  mockIo: vi.fn(() => createFakeSocket()),
}));

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

function getFakeSocket() {
  return mockIo.mock.results[mockIo.mock.results.length - 1]
    ?.value as ReturnType<typeof createFakeSocket>;
}

describe('useGameSocket — state sync', () => {
  beforeEach(() => {
    mockIo.mockClear();
  });

  it('adopts the snapshot sent on STATE_SYNC', async () => {
    const { result } = renderHook(() => useGameSocket('display'));
    const fakeSocket = getFakeSocket();
    const snapshot = {
      progress: {
        status: 'lobby',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
      },
      currentQuestion: null,
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot);
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
  });

  it('adopts the snapshot sent on STATE_UPDATED', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();
    const snapshot = {
      progress: {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
      },
      currentQuestion: {
        id: 'r1q1',
        type: 'free_text' as const,
        prompt: 'Q?',
        points: 1,
      },
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_UPDATED, snapshot);
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
  });

  it('accumulates block questions into seenQuestions across snapshots', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    const q2 = {
      id: 2,
      type: 'free_text' as const,
      prompt: 'Name a planet',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 2,
      roundTitle: 'Round 1',
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_SYNC, {
        progress: {
          status: 'question_open',
          roundIndex: 0,
          questionIndex: 0,
          isLeaderboardVisible: false,
        },
        currentQuestion: q1,
        blockQuestions: [q1],
        revealQuestions: [],
      });
    });
    await waitFor(() =>
      expect(result.current.seenQuestions).toEqual({ 1: q1 }),
    );

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_UPDATED, {
        progress: {
          status: 'question_open',
          roundIndex: 0,
          questionIndex: 1,
          isLeaderboardVisible: false,
        },
        currentQuestion: q2,
        blockQuestions: [q1, q2],
        revealQuestions: [],
      });
    });
    await waitFor(() =>
      expect(result.current.seenQuestions).toEqual({ 1: q1, 2: q2 }),
    );
  });

  it('upgrades a seen question with its revealed answer once reveal arrives', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();
    const q1 = {
      id: 1,
      type: 'free_text' as const,
      prompt: 'Name a fruit',
      points: 1,
      roundNumber: 1,
      questionNumberInRound: 1,
      roundTitle: 'Round 1',
    };
    const revealedQ1 = { ...q1, answer: 'Banana' };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_SYNC, {
        progress: {
          status: 'question_open',
          roundIndex: 0,
          questionIndex: 0,
          isLeaderboardVisible: false,
        },
        currentQuestion: q1,
        blockQuestions: [q1],
        revealQuestions: [],
      });
    });
    await waitFor(() =>
      expect(result.current.seenQuestions).toEqual({ 1: q1 }),
    );

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_UPDATED, {
        progress: {
          status: 'reveal',
          roundIndex: 0,
          questionIndex: 0,
          isLeaderboardVisible: false,
        },
        currentQuestion: null,
        blockQuestions: [],
        revealQuestions: [revealedQ1],
      });
    });
    await waitFor(() =>
      expect(result.current.seenQuestions).toEqual({ 1: revealedQ1 }),
    );
  });
});
