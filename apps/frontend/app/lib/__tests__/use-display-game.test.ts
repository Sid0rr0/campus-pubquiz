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
      'snapshot',
    ]);
  });

  it('exposes the snapshot on sync and a refused connection as the connection error', () => {
    const { result } = renderHook(() => useDisplayGame(true, 'TESTCODE'));
    const socket = latestSocket();
    const snapshot = { joinCode: 'TESTCODE' };

    act(() => socket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot));
    expect(result.current.snapshot).toEqual(snapshot);

    act(() => socket.trigger('connect_error', new Error('Nope')));
    expect(result.current.connectionError).toBe('Nope');
  });

  it('does not connect while disabled', () => {
    renderHook(() => useDisplayGame(false, undefined));

    expect(mockIo).not.toHaveBeenCalled();
  });
});
