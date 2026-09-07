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

describe('useGameSocket — presenter context', () => {
  beforeEach(() => {
    mockIo.mockClear();
  });

  it('starts with no presenter context', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    expect(result.current.presenterContext).toBeNull();
  });

  it('adopts the payload sent on PRESENTER_CONTEXT_UPDATED', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();
    const payload = {
      currentQuestionNotes: 'Remind teams: EU capitals only.',
      nextQuestion: {
        id: 2,
        type: 'free_text' as const,
        prompt: 'Name a planet',
        points: 1,
        answer: 'Jupiter',
      },
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED, payload);
    });

    await waitFor(() =>
      expect(result.current.presenterContext).toEqual(payload),
    );
  });

  it('resets presenterContext to null on a fresh connect (identity-key change)', async () => {
    const { result, rerender } = renderHook(
      ({ joinCode }: { joinCode: string }) =>
        useGameSocket('admin', true, joinCode),
      { initialProps: { joinCode: 'AAAAAA' } },
    );
    const firstSocket = getFakeSocket();

    act(() => {
      firstSocket.trigger(SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED, {
        currentQuestionNotes: 'note',
        nextQuestion: null,
      });
    });
    await waitFor(() => expect(result.current.presenterContext).not.toBeNull());

    rerender({ joinCode: 'BBBBBB' });

    expect(result.current.presenterContext).toBeNull();
  });
});
