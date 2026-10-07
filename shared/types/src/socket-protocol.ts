import {
  SOCKET_EVENTS,
  type AckResult,
  type SocketRoomName,
} from './socket-events';
import type {
  AdminActionPayload,
  SetBreakEndTimePayload,
  SetDisplayTextScalePayload,
} from './admin-actions';
import type {
  AnswerReceivedPayload,
  AnswersUpdatedPayload,
  GradeAnswerPayload,
  SubmitAnswerPayload,
  TeamAnswersSyncedPayload,
} from './answers';
import type { AwardBonusPayload, BonusAwardedPayload } from './bonus';
import type { RateRoundPayload, SendFeedbackPayload } from './feedback';
import type { PresenterContextPayload, StateViewByRoom } from './room-views';
import type {
  CreateShowdownRoundPayload,
  SubmitShowdownGuessPayload,
} from './showdown';
import type {
  JoinAcceptedPayload,
  JoinPlayersPayload,
  KickTeamPayload,
  LeaveSessionPayload,
  SessionClosedPayload,
} from './team-presence';

/**
 * The socket protocol map: every event is declared once here, by its wire
 * name (the `SOCKET_EVENTS` values), and both ends type their sockets
 * against it. Types only — nothing in this file exists at runtime.
 */

/** Client-to-server events: each one's payload, and the data its acknowledgement carries (`void` when it carries none). */
export interface ClientToServerProtocol {
  [SOCKET_EVENTS.ADMIN_ACTION]: { payload: AdminActionPayload; ack: void };
  [SOCKET_EVENTS.SUBMIT_ANSWER]: { payload: SubmitAnswerPayload; ack: void };
  [SOCKET_EVENTS.JOIN_PLAYERS]: { payload: JoinPlayersPayload; ack: void };
  [SOCKET_EVENTS.GRADE_ANSWER]: { payload: GradeAnswerPayload; ack: void };
  [SOCKET_EVENTS.KICK_TEAM]: { payload: KickTeamPayload; ack: void };
  [SOCKET_EVENTS.LEAVE_SESSION]: { payload: LeaveSessionPayload; ack: void };
  [SOCKET_EVENTS.AWARD_BONUS]: { payload: AwardBonusPayload; ack: void };
  [SOCKET_EVENTS.SET_BREAK_END_TIME]: {
    payload: SetBreakEndTimePayload;
    ack: void;
  };
  [SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE]: {
    payload: SetDisplayTextScalePayload;
    ack: void;
  };
  [SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND]: {
    payload: CreateShowdownRoundPayload;
    ack: void;
  };
  [SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS]: {
    payload: SubmitShowdownGuessPayload;
    ack: void;
  };
  [SOCKET_EVENTS.RATE_ROUND]: { payload: RateRoundPayload; ack: void };
  [SOCKET_EVENTS.SEND_FEEDBACK]: { payload: SendFeedbackPayload; ack: void };
}

export type ClientToServerEvent = keyof ClientToServerProtocol;

/** The payload type of one client-to-server event. */
export type ClientToServerPayload<E extends ClientToServerEvent> =
  ClientToServerProtocol[E]['payload'];

/** The data type of one client-to-server event's acknowledgement. */
export type ClientToServerAck<E extends ClientToServerEvent> =
  ClientToServerProtocol[E]['ack'];

/** Payload of the `exception` message the connection sends when a handler throws. */
export interface ExceptionPayload {
  status?: string;
  message: string;
}

/** Server-to-client events that don't depend on the room, each with its payload (`void` for none). `STATE_SYNC` and `STATE_UPDATED` are per room — see `ServerToClientProtocolByRoom`. */
export interface ServerToClientProtocol {
  [SOCKET_EVENTS.ANSWER_RECEIVED]: AnswerReceivedPayload;
  [SOCKET_EVENTS.JOIN_ACCEPTED]: JoinAcceptedPayload;
  [SOCKET_EVENTS.ANSWERS_UPDATED]: AnswersUpdatedPayload;
  [SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED]: PresenterContextPayload;
  [SOCKET_EVENTS.TEAM_ANSWERS_SYNCED]: TeamAnswersSyncedPayload;
  [SOCKET_EVENTS.BONUS_AWARDED]: BonusAwardedPayload;
  [SOCKET_EVENTS.SESSION_CLOSED]: SessionClosedPayload;
  [SOCKET_EVENTS.TEAM_KICKED]: void;
  exception: ExceptionPayload;
}

/** The full server-to-client map for one room: the shared events plus that room's own state view on `STATE_SYNC` and `STATE_UPDATED`. */
export interface ServerToClientProtocolByRoom<
  R extends SocketRoomName,
> extends ServerToClientProtocol {
  [SOCKET_EVENTS.STATE_SYNC]: StateViewByRoom[R];
  [SOCKET_EVENTS.STATE_UPDATED]: StateViewByRoom[R];
}

/** `socket.io`-shaped listener map a socket receiving as room `R` is typed with (`Socket<ServerToClientEvents<R>, ClientToServerEvents>` on the client, the reverse on the server). `TEAM_KICKED` carries no payload, so its listener takes no argument. */
export type ServerToClientEvents<R extends SocketRoomName> = {
  [E in Exclude<
    keyof ServerToClientProtocolByRoom<R>,
    typeof SOCKET_EVENTS.TEAM_KICKED
  >]: (payload: ServerToClientProtocolByRoom<R>[E]) => void;
} & { [SOCKET_EVENTS.TEAM_KICKED]: () => void };

/** `socket.io`-shaped listener map for what the server receives: payload, then the acknowledgement callback. */
export type ClientToServerEvents = {
  [E in ClientToServerEvent]: (
    payload: ClientToServerPayload<E>,
    ack: (result: AckResult<ClientToServerAck<E>>) => void,
  ) => void;
};
