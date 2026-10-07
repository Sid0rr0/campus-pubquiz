import type { z } from 'zod';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type ClientToServerEvent,
  type ClientToServerPayload,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import {
  adminActionPayloadSchema,
  awardBonusPayloadSchema,
  createShowdownRoundPayloadSchema,
  gradeAnswerPayloadSchema,
  joinPlayersPayloadSchema,
  kickTeamPayloadSchema,
  leaveSessionPayloadSchema,
  rateRoundPayloadSchema,
  sendFeedbackPayloadSchema,
  setBreakEndTimePayloadSchema,
  setDisplayTextScalePayloadSchema,
  submitAnswerPayloadSchema,
  submitShowdownGuessPayloadSchema,
} from '@/game/socket/socket-payload.schemas';

/** Everything the dispatch step needs to know about one client-to-server event. */
export interface SocketEventDeclaration<S extends z.ZodType = z.ZodType> {
  readonly event: ClientToServerEvent;
  readonly schema: S;
  /** The one room allowed to send this event; required so none can go undeclared. */
  readonly allowedRoom: SocketRoomName;
  /** What any other room is told. */
  readonly rejection: string;
  /** Payload fields named in the "accepted" log line. Never answer text. */
  readonly logFields: readonly (keyof z.infer<S> & string)[];
}

/** `S` itself when its output and the event's protocol payload are assignable both ways, else `never` (so the declaration doesn't compile). */
type SchemaInStepWith<E extends ClientToServerEvent, S extends z.ZodType> = [
  z.output<S>,
] extends [ClientToServerPayload<E>]
  ? [ClientToServerPayload<E>] extends [z.output<S>]
    ? S
    : never
  : never;

/**
 * Declares one event. The schema stays the runtime boundary validation; the
 * compiler checks that what it outputs is the payload type both ends use.
 */
export function declareSocketEvent<
  E extends ClientToServerEvent,
  S extends z.ZodType,
>(
  declaration: Omit<SocketEventDeclaration<S>, 'event' | 'schema'> & {
    readonly event: E;
    readonly schema: SchemaInStepWith<E, S>;
  },
): SocketEventDeclaration<S> {
  return declaration;
}

export const SOCKET_EVENT_DECLARATIONS = {
  adminAction: declareSocketEvent({
    event: SOCKET_EVENTS.ADMIN_ACTION,
    schema: adminActionPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may perform game actions',
    logFields: ['action'],
  }),
  joinPlayers: declareSocketEvent({
    event: SOCKET_EVENTS.JOIN_PLAYERS,
    schema: joinPlayersPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may join a team',
    logFields: ['teamName'],
  }),
  submitAnswer: declareSocketEvent({
    event: SOCKET_EVENTS.SUBMIT_ANSWER,
    schema: submitAnswerPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may submit answers',
    logFields: ['questionId', 'teamId'],
  }),
  rateRound: declareSocketEvent({
    event: SOCKET_EVENTS.RATE_ROUND,
    schema: rateRoundPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may rate a round',
    logFields: ['roundId', 'stars'],
  }),
  sendFeedback: declareSocketEvent({
    event: SOCKET_EVENTS.SEND_FEEDBACK,
    schema: sendFeedbackPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may send feedback',
    logFields: [],
  }),
  gradeAnswer: declareSocketEvent({
    event: SOCKET_EVENTS.GRADE_ANSWER,
    schema: gradeAnswerPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may grade answers',
    logFields: ['answerId', 'pointsAwarded'],
  }),
  kickTeam: declareSocketEvent({
    event: SOCKET_EVENTS.KICK_TEAM,
    schema: kickTeamPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may remove a team',
    logFields: ['teamId'],
  }),
  leaveSession: declareSocketEvent({
    event: SOCKET_EVENTS.LEAVE_SESSION,
    schema: leaveSessionPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may leave a session',
    logFields: ['teamId'],
  }),
  setBreakEndTime: declareSocketEvent({
    event: SOCKET_EVENTS.SET_BREAK_END_TIME,
    schema: setBreakEndTimePayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set the break end time',
    logFields: ['breakEndsAt'],
  }),
  setDisplayTextScale: declareSocketEvent({
    event: SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE,
    schema: setDisplayTextScalePayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set the display text scale',
    logFields: ['displayTextScale'],
  }),
  awardBonus: declareSocketEvent({
    event: SOCKET_EVENTS.AWARD_BONUS,
    schema: awardBonusPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may award bonus points',
    logFields: ['teamId', 'category', 'points'],
  }),
  createShowdownRound: declareSocketEvent({
    event: SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND,
    schema: createShowdownRoundPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may start a showdown round',
    logFields: ['points'],
  }),
  submitShowdownGuess: declareSocketEvent({
    event: SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS,
    schema: submitShowdownGuessPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may submit a showdown guess',
    logFields: ['showdownRoundId', 'teamId'],
  }),
} as const;
