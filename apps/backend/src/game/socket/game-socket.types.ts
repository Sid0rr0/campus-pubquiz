import type { BroadcastOperator, Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  sessionRoom,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketRoomName,
} from '@campus-pubquiz/types';

/**
 * What the server may emit without naming a room: every server-to-client
 * event except the two state events, whose payload depends on the room they
 * go to (see `RoomEmitter`).
 */
export type GameEmitEvents = Omit<
  ServerToClientEvents<SocketRoomName>,
  typeof SOCKET_EVENTS.STATE_SYNC | typeof SOCKET_EVENTS.STATE_UPDATED
>;

/** The gateway's `socket.io` server, typed by the socket protocol. */
export type GameServer = Server<ClientToServerEvents, GameEmitEvents>;

/** One connected client, typed by the socket protocol. */
export type GameSocket = Socket<ClientToServerEvents, GameEmitEvents>;

/** Emits to one room of a session, with that room's state view on `STATE_SYNC` and `STATE_UPDATED`. */
export type RoomEmitter<R extends SocketRoomName> = Pick<
  BroadcastOperator<ServerToClientEvents<R>, unknown>,
  'emit'
>;

/**
 * The only place a room's state view is tied to the room it is sent to:
 * the typed server knows the room-independent events, and this narrows its
 * emitters (and a connecting socket) to one room's full event map.
 */
export function roomEmitter<R extends SocketRoomName>(
  server: GameServer,
  joinCode: string,
  room: R,
): RoomEmitter<R> {
  return server.to(sessionRoom(joinCode, room)) as unknown as RoomEmitter<R>;
}

/** `client` as a socket of room `R`, so its `STATE_SYNC` carries `R`'s view. */
export function socketOfRoom<R extends SocketRoomName>(
  client: GameSocket,
): Pick<Socket<ClientToServerEvents, ServerToClientEvents<R>>, 'emit'> {
  return client as unknown as Pick<
    Socket<ClientToServerEvents, ServerToClientEvents<R>>,
    'emit'
  >;
}
