'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type AckResult,
  type ClientToServerAck,
  type ClientToServerEvent,
  type ClientToServerEvents,
  type ClientToServerPayload,
  type ServerToClientEvents,
  type SocketRoomName,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';
import {
  NOT_CONNECTED_MESSAGE,
  RECONNECTING_MESSAGE,
} from '@/app/lib/connection-messages';

/** How long an emit may go unacknowledged before it resolves to a failure. */
export const ACK_TIMEOUT_MS = 10_000;

/** A socket typed by the protocol map for the room it connects as. */
export type RoomSocket<Role extends SocketRoomName> = Socket<
  ServerToClientEvents<Role>,
  ClientToServerEvents
>;

export type EmitWithAck = <E extends ClientToServerEvent>(
  event: E,
  payload: ClientToServerPayload<E>,
) => Promise<AckResult<ClientToServerAck<E>>>;

export type ConnectionIssue = 'reconnecting' | 'refused';

export interface SocketConnection {
  socketId: string | null;
}

export interface UseGameConnectionResult<Role extends SocketRoomName> {
  snapshot: StateViewByRoom[Role] | null;
  /** Set only by connection problems (refused, lost, reconnecting) — never by a rejected action. */
  connectionError: string | null;
  /** Why the socket isn't connected: socket.io is retrying (`reconnecting`) or the server turned it away (`refused`). Null while connected. */
  connectionIssue: ConnectionIssue | null;
  /** Timestamp of the most recent successful (re)connection, including the first. */
  reconnectedAt: number | null;
  /** The live connection: a new object on every connect (so a reconnect is never mistaken for the connection before it), null while disconnected. */
  socketConnection: SocketConnection | null;
  /** Changes whenever the socket identity does — role hooks reset their own state when it does. */
  identityKey: string;
  emitWithAck: EmitWithAck;
  /** Drops the current socket and opens a fresh connection, showing the reconnecting banner meanwhile — for a socket that looks connected but has stopped answering. */
  forceReconnect: () => void;
}

/**
 * The socket core every page's hook builds on (the rules page calls it
 * directly): the socket lifecycle, the snapshot, the connection error, the reconnect
 * timestamp and an emit-with-acknowledgement helper. A role hook adds its own
 * listeners through `bindSocket`, which runs once for each new socket.
 */
export function useGameConnection<Role extends SocketRoomName>(
  role: Role,
  enabled: boolean,
  joinCode: string | undefined,
  bindSocket?: (socket: RoomSocket<Role>) => void,
  // Bumped by callers to force a fresh socket when role/joinCode are unchanged.
  retryKey = 0,
): UseGameConnectionResult<Role> {
  const [snapshot, setSnapshot] = useState<StateViewByRoom[Role] | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] =
    useState<ConnectionIssue | null>(null);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const [socketConnection, setSocketConnection] =
    useState<SocketConnection | null>(null);
  const socketRef = useRef<RoomSocket<Role> | null>(null);
  const bindSocketRef = useRef(bindSocket);
  useEffect(() => {
    bindSocketRef.current = bindSocket;
  }, [bindSocket]);

  // The error text and the issue always change together.
  const reportConnection = useCallback(
    (issue: ConnectionIssue | null, message: string | null) => {
      setConnectionError(message);
      setConnectionIssue(issue);
    },
    [],
  );

  // A fresh connect starts from a clean slate — adjusted during render, keyed
  // the same way the connect Effect's dependency array is.
  const identityKey = `${enabled}|${role}|${joinCode ?? ''}|${retryKey}`;
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    if (enabled) {
      setSnapshot(null);
      reportConnection(null, null);
      setSocketConnection(null);
    }
  }

  useEffect(() => {
    if (!enabled) return;

    const socket: RoomSocket<Role> = io(getBackendUrl(), {
      query: joinCode ? { role, code: joinCode } : { role },
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setReconnectedAt(Date.now());
      setSocketConnection({ socketId: socket.id ?? null });
    });
    socket.on(SOCKET_EVENTS.STATE_SYNC, (payload) => {
      setSnapshot(payload);
      reportConnection(null, null);
    });
    socket.on(SOCKET_EVENTS.STATE_UPDATED, (payload) => {
      setSnapshot(payload);
    });
    socket.on('connect_error', () => {
      // The backend refuses a socket by accepting and then disconnecting it
      // (see `disconnect` below), never with a CONNECT_ERROR packet. So every
      // `connect_error` is a transport failure — including each failed retry
      // while the network is down — and socket.io is still retrying.
      reportConnection('reconnecting', RECONNECTING_MESSAGE);
    });
    socket.on('disconnect', (reason: string) => {
      setSocketConnection(null);
      if (reason === 'io client disconnect') return;
      if (reason === 'io server disconnect') {
        // The server refused this socket — socket.io won't retry on its own.
        reportConnection('refused', `Disconnected: ${reason}`);
        return;
      }
      reportConnection('reconnecting', RECONNECTING_MESSAGE);
    });
    bindSocketRef.current?.(socket);

    return () => {
      socket.disconnect();
    };
  }, [enabled, role, joinCode, retryKey, reportConnection]);

  const emitWithAck = useCallback(
    <E extends ClientToServerEvent>(
      event: E,
      payload: ClientToServerPayload<E>,
    ): Promise<AckResult<ClientToServerAck<E>>> => {
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
        // socket.io's typed `emit` can't resolve a generic event against its
        // listener map, so the call is typed by the same protocol signature
        // this function's own parameters carry.
        const emit = socket.emit.bind(socket) as (
          event: E,
          payload: ClientToServerPayload<E>,
          ack: (result: AckResult<ClientToServerAck<E>>) => void,
        ) => void;
        emit(event, payload, (result) => {
          clearTimeout(timer);
          resolve(result);
        });
      });
    },
    [],
  );

  const forceReconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    reportConnection('reconnecting', RECONNECTING_MESSAGE);
    socket.disconnect();
    socket.connect();
  }, [reportConnection]);

  return {
    snapshot,
    connectionError,
    connectionIssue,
    reconnectedAt,
    socketConnection,
    identityKey,
    emitWithAck,
    forceReconnect,
  };
}
