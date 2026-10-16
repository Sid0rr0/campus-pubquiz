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
});
