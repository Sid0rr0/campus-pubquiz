import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useDisplayGame } from '@/app/lib/use-display-game';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: mockIo }));

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

describe('useDisplayGame', () => {
  beforeEach(() => {
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
  });

  it('connects to the display room with the session code and exposes only the snapshot and connection error', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));

    expect(mockIo.mock.calls[0][1]).toMatchObject({
      query: { role: 'display', code: 'TESTCODE' },
    });
    expect(Object.keys(result.current).sort()).toEqual([
      'connectionError',
      'connectionIssue',
      'snapshot',
    ]);
  });

  it('keeps the snapshot and reports reconnecting after a transient disconnect', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));
    const socket = latestSocket();
    const snapshot = { joinCode: 'TESTCODE' };
    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot));

    act(() => socket.serverDisconnects('transport close'));

    expect(result.current.connectionIssue).toBe('reconnecting');
    expect(result.current.snapshot).toEqual(snapshot);
  });

  it('clears the issue and resyncs when the socket comes back', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));
    const socket = latestSocket();
    act(() => socket.serverConnects());
    act(() => socket.serverDisconnects('ping timeout'));

    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, { joinCode: 'NEW' }));

    expect(result.current.connectionIssue).toBeNull();
    expect(result.current.connectionError).toBeNull();
    expect(result.current.snapshot).toEqual({ joinCode: 'NEW' });
  });

  it('reports refused when the server disconnects the socket', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));
    const socket = latestSocket();
    act(() => socket.serverConnects());

    act(() => socket.serverDisconnects('io server disconnect'));

    expect(result.current.connectionIssue).toBe('refused');
  });

  it('keeps reconnecting with its snapshot when a retry fails after a network drop', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));
    const socket = latestSocket();
    const snapshot = { joinCode: 'TESTCODE' };
    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot));
    act(() => socket.serverDisconnects('transport close'));

    act(() => socket.trigger('connect_error', new Error('xhr poll error')));

    expect(result.current.connectionIssue).toBe('reconnecting');
    expect(result.current.snapshot).toEqual(snapshot);
  });

  it('exposes the snapshot on sync and a refused connection as the connection error', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));
    const socket = latestSocket();
    const snapshot = { joinCode: 'TESTCODE' };

    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot));
    expect(result.current.snapshot).toEqual(snapshot);

    act(() => socket.serverDisconnects('io server disconnect'));
    expect(result.current.connectionError).toBe(
      'Disconnected: io server disconnect',
    );
  });

  it('does not connect while disabled', () => {
    renderHook(() => useDisplayGame(false, undefined));

    expect(mockIo).not.toHaveBeenCalled();
  });
});
