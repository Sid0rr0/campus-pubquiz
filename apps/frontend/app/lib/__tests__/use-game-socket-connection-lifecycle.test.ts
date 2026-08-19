import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

describe('useGameSocket — connection lifecycle', () => {
  beforeEach(() => {
    mockIo.mockClear();
  });

  it('connects with credentials so the session cookie is sent on the handshake', () => {
    renderHook(() => useGameSocket('admin'));

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3000', {
      query: { role: 'admin' },
      withCredentials: true,
    });
  });

  it('starts with no snapshot and no error', () => {
    const { result } = renderHook(() => useGameSocket('display'));
    expect(result.current.snapshot).toBeNull();
    expect(result.current.connectionError).toBeNull();
  });

  it('does not open a socket until enabled for admin connections', () => {
    renderHook(() => useGameSocket('admin', false));

    expect(mockIo).not.toHaveBeenCalled();
  });

  it('includes the join code in the handshake query when provided', () => {
    renderHook(() => useGameSocket('display', true, 'ABCDEF'));

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3000', {
      query: { role: 'display', code: 'ABCDEF' },
      withCredentials: true,
    });
  });

  it('reconnects with a new handshake query when the join code changes', () => {
    const { rerender } = renderHook(
      ({ joinCode }: { joinCode: string }) =>
        useGameSocket('display', true, joinCode),
      { initialProps: { joinCode: 'AAAAAA' } },
    );
    const firstSocket = getFakeSocket();

    rerender({ joinCode: 'BBBBBB' });

    expect(firstSocket.disconnect).toHaveBeenCalled();
    expect(mockIo).toHaveBeenLastCalledWith('http://localhost:3000', {
      query: { role: 'display', code: 'BBBBBB' },
      withCredentials: true,
    });
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderHook(() => useGameSocket('display'));
    const fakeSocket = getFakeSocket();
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });
});
