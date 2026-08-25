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

  it('clears a stale join error once JOIN_ACCEPTED confirms the team', async () => {
    // Reproduces a double-tapped join button: the first JOIN_PLAYERS request
    // wins and creates the team, but a second, near-simultaneous request for
    // the same brand-new name loses the race and comes back "already
    // registered". Without clearing the error here, that stale banner stays
    // up forever even though the team is now fully connected.
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('exception', {
        message:
          'Team name "The Quizzards" is already registered — enter its team code to play as this team, or choose a different name',
      });
    });
    await waitFor(() =>
      expect(result.current.connectionError).toContain('already registered'),
    );

    act(() => {
      fakeSocket.trigger('game:join_accepted', {
        teamId: 1,
        teamName: 'The Quizzards',
        teamToken: 'token-1',
        teamCode: 'QUICK-JADE-FOX',
        answers: [],
        bonusAwards: [],
      });
    });

    await waitFor(() => expect(result.current.team).not.toBeNull());
    expect(result.current.connectionError).toBeNull();
  });
});
