import { renderHook, act, waitFor } from '@testing-library/react';
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

describe('useGameSocket — connection errors', () => {
  beforeEach(() => {
    mockIo.mockClear();
  });

  it('surfaces a server exception as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('exception', {
        message: 'Only admin clients may perform game actions',
      });
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe(
        'Only admin clients may perform game actions',
      ),
    );
  });

  it('surfaces a socket connect_error as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('connect_error', {
        message: 'Invalid admin password',
      });
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe('Invalid admin password'),
    );
  });

  it('surfaces a server disconnect as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('disconnect', 'io server disconnect');
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe(
        'Disconnected: io server disconnect',
      ),
    );
  });

  it('keeps the first error when a disconnect follows an exception', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('exception', { message: 'Invalid admin password' });
      fakeSocket.trigger('disconnect', 'io server disconnect');
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe('Invalid admin password'),
    );
  });
});
