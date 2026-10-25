import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useGameConnection } from '@/app/lib/use-game-connection';
import { RECONNECTING_MESSAGE } from '@/app/lib/connection-messages';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: mockIo }));

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

/** What socket.io-client emits for every failed retry while the network is down. */
function transportError() {
  return Object.assign(new Error('xhr poll error'), {
    type: 'TransportError',
  });
}

describe('useGameConnection', () => {
  beforeEach(() => {
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
  });

  it('keeps reconnecting and the snapshot when a retry fails after a network drop', () => {
    const { result } = renderHook(() =>
      useGameConnection('display', true, 'TESTCODE'),
    );
    const socket = latestSocket();
    const snapshot = { joinCode: 'TESTCODE' };
    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot));
    act(() => socket.serverDisconnects('transport close'));

    act(() => socket.trigger('connect_error', transportError()));

    expect(result.current.connectionIssue).toBe('reconnecting');
    expect(result.current.connectionError).toBe(RECONNECTING_MESSAGE);
    expect(result.current.snapshot).toEqual(snapshot);
  });

  it('reports reconnecting, not refused, when the very first connect fails', () => {
    const { result } = renderHook(() =>
      useGameConnection('display', true, 'TESTCODE'),
    );

    act(() => latestSocket().trigger('connect_error', transportError()));

    expect(result.current.connectionIssue).toBe('reconnecting');
  });

  it('reports refused, with the reason, when the server disconnects the socket', () => {
    const { result } = renderHook(() =>
      useGameConnection('display', true, 'NOPE'),
    );
    const socket = latestSocket();
    act(() => socket.serverConnects());

    act(() => socket.serverDisconnects('io server disconnect'));

    expect(result.current.connectionIssue).toBe('refused');
    expect(result.current.connectionError).toBe(
      'Disconnected: io server disconnect',
    );
  });

  it('reports nothing when the client itself disconnects, but drops the live connection', () => {
    const { result } = renderHook(() =>
      useGameConnection('display', true, 'TESTCODE'),
    );
    const socket = latestSocket();
    act(() => socket.serverConnects());
    expect(result.current.socketConnection).not.toBeNull();

    act(() => socket.serverDisconnects('io client disconnect'));

    expect(result.current.connectionIssue).toBeNull();
    expect(result.current.connectionError).toBeNull();
    expect(result.current.socketConnection).toBeNull();
  });

  it('connects with credentials, sending the role and the join code', () => {
    renderHook(() => useGameConnection('players', true, 'TESTCODE'));

    expect(mockIo).toHaveBeenCalledWith(expect.any(String), {
      query: { role: 'players', code: 'TESTCODE' },
      withCredentials: true,
    });
  });

  it('sends only the role when there is no join code', () => {
    renderHook(() => useGameConnection('admin', true, undefined));

    expect(mockIo.mock.calls[0]?.[1]).toEqual({
      query: { role: 'admin' },
      withCredentials: true,
    });
  });

  it('keys the identity by every input to the connection', () => {
    const { result, rerender } = renderHook(
      ({ code, retryKey }: { code: string | undefined; retryKey: number }) =>
        useGameConnection('display', true, code, undefined, retryKey),
      { initialProps: { code: undefined as string | undefined, retryKey: 0 } },
    );
    expect(result.current.identityKey).toBe('true|display||0');

    rerender({ code: 'ABC', retryKey: 2 });
    expect(result.current.identityKey).toBe('true|display|ABC|2');
  });

  it('starts a fresh connect from a clean slate when the identity changes', () => {
    const { result, rerender } = renderHook(
      ({ retryKey }: { retryKey: number }) =>
        useGameConnection('display', true, 'TESTCODE', undefined, retryKey),
      { initialProps: { retryKey: 0 } },
    );
    const socket = latestSocket();
    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, { joinCode: 'X' }));
    act(() => socket.trigger('connect_error', transportError()));
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.connectionError).toBe(RECONNECTING_MESSAGE);
    expect(result.current.socketConnection).not.toBeNull();

    rerender({ retryKey: 1 });

    expect(result.current.snapshot).toBeNull();
    expect(result.current.connectionError).toBeNull();
    expect(result.current.connectionIssue).toBeNull();
    expect(result.current.socketConnection).toBeNull();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('binds each new socket with the latest bindSocket callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({
        bind,
        retryKey,
      }: {
        bind: (socket: unknown) => void;
        retryKey: number;
      }) => useGameConnection('display', true, 'TESTCODE', bind, retryKey),
      { initialProps: { bind: first, retryKey: 0 } },
    );
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ bind: second, retryKey: 0 });
    expect(second).not.toHaveBeenCalled();

    rerender({ bind: second, retryKey: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
