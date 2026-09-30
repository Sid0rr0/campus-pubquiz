'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type AckResult,
  type SocketRoomName,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

/** How long an emit may go unacknowledged before it resolves to a failure. */
export const ACK_TIMEOUT_MS = 10_000;
export const RECONNECTING_MESSAGE = 'Connection lost — reconnecting…';
export const NOT_CONNECTED_MESSAGE =
  "You're not connected right now — hang on while we reconnect, then try again.";

export type EmitWithAck = <T = void>(
  event: string,
  payload: unknown,
) => Promise<AckResult<T>>;

export interface UseGameConnectionResult<Role extends SocketRoomName> {
  snapshot: StateViewByRoom[Role] | null;
  /** Set only by connection problems (refused, lost, reconnecting) — never by a rejected action. */
  connectionError: string | null;
  /** Timestamp of the most recent successful (re)connection, including the first. */
  reconnectedAt: number | null;
  /** Changes whenever the socket identity does — role hooks reset their own state when it does. */
  identityKey: string;
  emitWithAck: EmitWithAck;
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

/**
 * Internal core shared by the role hooks (pages never call it directly): the
 * socket lifecycle, the snapshot, the connection error, the reconnect
 * timestamp and an emit-with-acknowledgement helper. A role hook adds its own
 * listeners through `bindSocket`, which runs once for each new socket.
 */
export function useGameConnection<Role extends SocketRoomName>(
  role: Role,
  enabled: boolean,
  joinCode: string | undefined,
  bindSocket?: (socket: Socket) => void,
  // Bumped by callers to force a fresh socket when role/joinCode are unchanged.
  retryKey = 0,
): UseGameConnectionResult<Role> {
  const [snapshot, setSnapshot] = useState<StateViewByRoom[Role] | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bindSocketRef = useRef(bindSocket);
  useEffect(() => {
    bindSocketRef.current = bindSocket;
  }, [bindSocket]);

  // A fresh connect starts from a clean slate — adjusted during render, keyed
  // the same way the connect Effect's dependency array is.
  const identityKey = `${enabled}|${role}|${joinCode ?? ''}|${retryKey}`;
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (enabled) {
      setSnapshot(null);
      setConnectionError(null);
    }
  }

  useEffect(() => {
    if (!enabled) return;

    const socket = io(getBackendUrl(), {
      query: joinCode ? { role, code: joinCode } : { role },
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setReconnectedAt(Date.now()));
    socket.on(SOCKET_EVENTS.STATE_SYNC, (payload: StateViewByRoom[Role]) => {
      setSnapshot(payload);
      setConnectionError(null);
    });
    socket.on(SOCKET_EVENTS.STATE_UPDATED, (payload: StateViewByRoom[Role]) => {
      setSnapshot(payload);
    });
    socket.on('connect_error', (payload: unknown) => {
      setConnectionError(getErrorMessage(payload));
    });
    socket.on('disconnect', (reason: string) => {
      if (reason === 'io client disconnect') return;
      if (reason === 'io server disconnect') {
        // The server refused this socket — socket.io won't retry on its own.
        setConnectionError((current) => current ?? `Disconnected: ${reason}`);
        return;
      }
      setConnectionError(RECONNECTING_MESSAGE);
    });
    bindSocketRef.current?.(socket);

    return () => {
      socket.disconnect();
    };
  }, [enabled, role, joinCode, retryKey]);

  const emitWithAck = useCallback(
    <T = void>(event: string, payload: unknown): Promise<AckResult<T>> => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        return Promise.resolve({
          success: false,
          error: NOT_CONNECTED_MESSAGE,
        });
      }
      return new Promise((resolve) => {
        const timer = setTimeout(
          () => resolve({ success: false, error: NOT_CONNECTED_MESSAGE }),
          ACK_TIMEOUT_MS,
        );
        socket.emit(event, payload, (result: AckResult<T>) => {
          clearTimeout(timer);
          resolve(result);
        });
      });
    },
    [],
  );

  return { snapshot, connectionError, reconnectedAt, identityKey, emitWithAck };
}
