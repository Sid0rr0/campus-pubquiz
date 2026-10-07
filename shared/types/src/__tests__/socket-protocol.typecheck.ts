/**
 * Compile-time assertions for the socket protocol map. This file is not a
 * vitest suite: the workspace typecheck compiles it, and a regression in the
 * map shows up as a type error here. (Named `.typecheck.ts`, not `.test.ts`,
 * because the package tsconfig excludes `*.test.ts` from compilation.)
 */
import {
  SOCKET_EVENTS,
  type AckResult,
  type AdminActionPayload,
  type AdminStatePayload,
  type ClientToServerEvents,
  type ClientToServerProtocol,
  type DisplayStatePayload,
  type PlayersStatePayload,
  type ServerToClientEvents,
  type ServerToClientProtocolByRoom,
  type SocketRoomName,
  type SubmitAnswerPayload,
} from '../index';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function assertType<_T extends true>(): void {}

type Payload<E extends keyof ClientToServerProtocol> =
  ClientToServerProtocol[E]['payload'];
type Ack<E extends keyof ClientToServerProtocol> =
  ClientToServerProtocol[E]['ack'];

// An event's payload is the one its declaration names.
assertType<
  Equal<Payload<typeof SOCKET_EVENTS.ADMIN_ACTION>, AdminActionPayload>
>();
assertType<
  Equal<Payload<typeof SOCKET_EVENTS.SUBMIT_ANSWER>, SubmitAnswerPayload>
>();

// An acknowledgement resolves to its event's type (void for every event today).
assertType<Equal<Ack<typeof SOCKET_EVENTS.ADMIN_ACTION>, void>>();
type AdminActionAckHandler = Parameters<
  Parameters<ClientToServerEvents[typeof SOCKET_EVENTS.ADMIN_ACTION]>[1]
>[0];
assertType<Equal<AdminActionAckHandler, AckResult<void>>>();

// Every room's STATE_SYNC / STATE_UPDATED is that room's view and no other.
type StateSyncPayload<R extends SocketRoomName> =
  ServerToClientProtocolByRoom<R>[typeof SOCKET_EVENTS.STATE_SYNC];
type StateUpdatedPayload<R extends SocketRoomName> =
  ServerToClientProtocolByRoom<R>[typeof SOCKET_EVENTS.STATE_UPDATED];
assertType<Equal<StateSyncPayload<'players'>, PlayersStatePayload>>();
assertType<Equal<StateSyncPayload<'admin'>, AdminStatePayload>>();
assertType<Equal<StateSyncPayload<'display'>, DisplayStatePayload>>();
assertType<Equal<StateUpdatedPayload<'players'>, PlayersStatePayload>>();
assertType<
  Equal<Equal<StateSyncPayload<'players'>, AdminStatePayload>, false>
>();

// TEAM_KICKED carries no payload: its listener takes no argument.
type TeamKickedListener =
  ServerToClientEvents<'players'>[typeof SOCKET_EVENTS.TEAM_KICKED];
assertType<Equal<Parameters<TeamKickedListener>, []>>();

// The connection's own `exception` message is on the wire too.
type ExceptionListener = ServerToClientEvents<'players'>['exception'];
assertType<Equal<Parameters<ExceptionListener>[0]['message'], string>>();

// A wrong payload for an event is a compile error.
declare const emitFn: <E extends keyof ClientToServerProtocol>(
  event: E,
  payload: Payload<E>,
) => void;
// @ts-expect-error a submit-answer payload is not an admin-action payload
emitFn(SOCKET_EVENTS.ADMIN_ACTION, { questionId: 1, teamId: 1, value: 'x' });
// @ts-expect-error a server-to-client event is not a client-to-server event
emitFn(SOCKET_EVENTS.STATE_SYNC, {});
emitFn(SOCKET_EVENTS.SUBMIT_ANSWER, { questionId: 1, teamId: 1, value: 'x' });

// A players-room listener cannot read an admin-only field.
declare const playersView: PlayersStatePayload;
// @ts-expect-error the players view does not carry the admin screen's advance step
void playersView.advanceStep;
