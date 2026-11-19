import type { z } from 'zod';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type ClientToServerEvent,
  type ClientToServerPayload,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import type { SessionState } from '@campus-pubquiz/types';
import type { LiveChangeModules } from '@/game/state/live-change-modules';
import type { SessionChange } from '@/game/state/session-write';
import type { SessionOutcome } from '@/game/state/session-outcome';
import {
  adminActionPayloadSchema,
  awardBonusPayloadSchema,
  buyPowerUpPayloadSchema,
  createShowdownRoundPayloadSchema,
  gradeAnswerPayloadSchema,
  joinPlayersPayloadSchema,
  kickTeamPayloadSchema,
  leaveSessionPayloadSchema,
  pickJokerPayloadSchema,
  pickSidePayloadSchema,
  rateRoundPayloadSchema,
  rateSessionPayloadSchema,
  sendFeedbackPayloadSchema,
  setPlayerCountPayloadSchema,
  setTeamPlayerCountPayloadSchema,
  setTeamSidePayloadSchema,
  setTeamJokerPayloadSchema,
  setBreakEndTimePayloadSchema,
  setDisplaySoundMutedPayloadSchema,
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
  /** The session change this event makes; the dispatch step runs it through the session write. Absent for join, which the game state class handles. */
  readonly change?: (
    changes: LiveChangeModules,
    session: SessionState,
    payload: z.output<S>,
    socketId: string,
  ) => Promise<SessionChange<SessionOutcome>>;
  /** Declaring it makes a failure of `change` that isn't a refusal one anyway: an Error's own message, else this text. Without it such a failure gets the generic error. */
  readonly fallbackRefusal?: string;
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
    change: (changes, session, { action }) =>
      changes.moveCommitter.commit(session, action),
    fallbackRefusal: 'Invalid game action',
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
    change: (changes, session, payload, socketId) =>
      changes.answers.submit(session, payload, socketId),
  }),
  rateRound: declareSocketEvent({
    event: SOCKET_EVENTS.RATE_ROUND,
    schema: rateRoundPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may rate a round',
    logFields: ['roundId', 'stars'],
    change: (changes, session, payload, socketId) =>
      changes.feedback.roundRated(session, payload, socketId),
  }),
  sendFeedback: declareSocketEvent({
    event: SOCKET_EVENTS.SEND_FEEDBACK,
    schema: sendFeedbackPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may send feedback',
    logFields: [],
    change: (changes, session, payload, socketId) =>
      changes.feedback.feedbackSent(session, payload, socketId),
  }),
  rateSession: declareSocketEvent({
    event: SOCKET_EVENTS.RATE_SESSION,
    schema: rateSessionPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may send feedback',
    logFields: ['scale', 'value'],
    change: (changes, session, payload, socketId) =>
      changes.feedback.sessionRated(session, payload, socketId),
  }),
  setPlayerCount: declareSocketEvent({
    event: SOCKET_EVENTS.SET_PLAYER_COUNT,
    schema: setPlayerCountPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may report a player count',
    logFields: ['playerCount'],
    change: (changes, session, payload, socketId) =>
      changes.playerCount.playerCountSet(session, payload, socketId),
  }),
  setTeamPlayerCount: declareSocketEvent({
    event: SOCKET_EVENTS.SET_TEAM_PLAYER_COUNT,
    schema: setTeamPlayerCountPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set a team’s player count',
    logFields: ['teamId', 'playerCount'],
    change: (changes, session, payload) =>
      changes.playerCount.teamPlayerCountSet(session, payload),
  }),
  pickJoker: declareSocketEvent({
    event: SOCKET_EVENTS.PICK_JOKER,
    schema: pickJokerPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may pick a joker',
    logFields: ['roundId'],
    change: (changes, session, payload, socketId) =>
      changes.joker.pick(session, payload, socketId),
  }),
  pickSide: declareSocketEvent({
    event: SOCKET_EVENTS.PICK_SIDE,
    schema: pickSidePayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may pick a side',
    logFields: ['sideId'],
    change: (changes, session, payload, socketId) =>
      changes.side.sidePicked(session, payload, socketId),
  }),
  setTeamSide: declareSocketEvent({
    event: SOCKET_EVENTS.SET_TEAM_SIDE,
    schema: setTeamSidePayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may move a team to a side',
    logFields: ['teamId', 'sideId'],
    change: (changes, session, payload) =>
      changes.side.teamSideSet(session, payload),
  }),
  setTeamJoker: declareSocketEvent({
    event: SOCKET_EVENTS.SET_TEAM_JOKER,
    schema: setTeamJokerPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set a team’s joker',
    logFields: ['teamId', 'roundId'],
    change: (changes, session, payload) =>
      changes.joker.setTeamJoker(session, payload),
  }),
  buyPowerUp: declareSocketEvent({
    event: SOCKET_EVENTS.BUY_POWER_UP,
    schema: buyPowerUpPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may buy a power-up',
    logFields: ['powerUp'],
    change: (changes, session, payload, socketId) =>
      changes.purchase.buy(session, payload, socketId),
  }),
  gradeAnswer: declareSocketEvent({
    event: SOCKET_EVENTS.GRADE_ANSWER,
    schema: gradeAnswerPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may grade answers',
    logFields: ['answerId', 'pointsAwarded'],
    change: (changes, session, { answerId, pointsAwarded }) =>
      changes.answers.grade(session, answerId, pointsAwarded),
  }),
  kickTeam: declareSocketEvent({
    event: SOCKET_EVENTS.KICK_TEAM,
    schema: kickTeamPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may remove a team',
    logFields: ['teamId'],
    change: (changes, session, { teamId }) =>
      changes.roster.kick(session, teamId),
  }),
  leaveSession: declareSocketEvent({
    event: SOCKET_EVENTS.LEAVE_SESSION,
    schema: leaveSessionPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may leave a session',
    logFields: ['teamId'],
    change: (changes, session, { teamId }, socketId) =>
      changes.roster.leave(session, { teamId, socketId }),
  }),
  setBreakEndTime: declareSocketEvent({
    event: SOCKET_EVENTS.SET_BREAK_END_TIME,
    schema: setBreakEndTimePayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set the break end time',
    logFields: ['breakEndsAt'],
    change: (changes, session, { breakEndsAt }) =>
      changes.settings.breakEndTime(session, breakEndsAt),
  }),
  setDisplayTextScale: declareSocketEvent({
    event: SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE,
    schema: setDisplayTextScalePayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set the display text scale',
    logFields: ['displayTextScale'],
    change: (changes, session, { displayTextScale }) =>
      changes.settings.displayTextScale(session, displayTextScale),
  }),
  setDisplaySoundMuted: declareSocketEvent({
    event: SOCKET_EVENTS.SET_DISPLAY_SOUND_MUTED,
    schema: setDisplaySoundMutedPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may mute the display sound',
    logFields: ['isDisplaySoundMuted'],
    change: (changes, session, { isDisplaySoundMuted }) =>
      changes.settings.displaySoundMuted(session, isDisplaySoundMuted),
  }),
  awardBonus: declareSocketEvent({
    event: SOCKET_EVENTS.AWARD_BONUS,
    schema: awardBonusPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may award bonus points',
    logFields: ['teamId', 'category', 'points'],
    change: (changes, session, payload) =>
      changes.bonus.award(session, payload),
  }),
  createShowdownRound: declareSocketEvent({
    event: SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND,
    schema: createShowdownRoundPayloadSchema,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may start a showdown round',
    logFields: ['points'],
    change: (changes, session, payload) =>
      changes.showdowns.newRound(session, payload),
  }),
  submitShowdownGuess: declareSocketEvent({
    event: SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS,
    schema: submitShowdownGuessPayloadSchema,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may submit a showdown guess',
    logFields: ['showdownRoundId', 'teamId'],
    change: (changes, session, payload, socketId) =>
      changes.showdowns.guess(session, payload, socketId),
  }),
} as const;
