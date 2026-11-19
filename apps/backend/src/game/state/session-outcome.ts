import {
  type ServerToClientProtocol,
  type SessionState,
  SOCKET_EVENTS,
} from '@campus-pubquiz/types';

/** One server-to-client event paired with its protocol payload, so a mismatched pair doesn't compile. An event that carries no payload (`TEAM_KICKED`) takes `undefined`. */
type EventEmit<E extends keyof ServerToClientProtocol> =
  E extends keyof ServerToClientProtocol
    ? { event: E; payload: ServerToClientProtocol[E] }
    : never;

/** A direct emit to one socket (kicked, bonus awarded), delivered after every room push. */
export type SocketNotice = { socketId: string } & EventEmit<
  | typeof SOCKET_EVENTS.TEAM_KICKED
  | typeof SOCKET_EVENTS.BONUS_AWARDED
  | typeof SOCKET_EVENTS.COIN_AWARDED
>;

/** A direct emit to the socket that sent the event (answer received, join accepted), delivered before any room push. */
export type SocketReply = EventEmit<
  typeof SOCKET_EVENTS.ANSWER_RECEIVED | typeof SOCKET_EVENTS.JOIN_ACCEPTED
>;

/** A connected team and the socket it is on. */
export interface TeamSync {
  teamId: number;
  socketId: string;
}

/** The session's phase timer deadlines (epoch-ms, or null when none is due) after a write that moved any of them. */
export interface DeadlineChange {
  questionLockAt: number | null;
  quickfireQuestionEndsAt: number | null;
  jokerPickEndsAt: number | null;
}

/**
 * The phase deadline table: every phase timer deadline once, with the label its
 * expiry logs under. `satisfies` makes a missing or extra row a type error.
 */
export const PHASE_DEADLINES = {
  questionLockAt: { label: 'Auto-lock' },
  quickfireQuestionEndsAt: { label: 'Quickfire auto-lock' },
  jokerPickEndsAt: { label: 'Joker pick close' },
} satisfies Record<keyof DeadlineChange, { label: string }>;

/** Every phase deadline key, in table order. */
export const PHASE_DEADLINE_KEYS = Object.keys(
  PHASE_DEADLINES,
) as (keyof DeadlineChange)[];

/** The phase timer deadlines of a session, the one place the set is built. */
export function deadlinesOf(session: DeadlineChange): DeadlineChange {
  return Object.fromEntries(
    PHASE_DEADLINE_KEYS.map((key) => [key, session[key]]),
  ) as unknown as DeadlineChange;
}

/**
 * What the Live session module says must be pushed after it applies an event.
 * The socket layer's one delivery step turns this into emits, so no caller
 * decides for itself which rooms hear about a change.
 */
export interface SessionOutcome {
  /** Emits to the sending socket, delivered before any room push. */
  replies: readonly SocketReply[];
  /** Presenter context to admin, then the state snapshot to all three rooms. */
  shouldBroadcastState: boolean;
  /** The admin room's view alone, afresh, for a change only the quiz master's screens show (a team's player count). Redundant when `shouldBroadcastState` is set. */
  shouldBroadcastAdminState: boolean;
  /** The big screen's view alone, afresh, for a change only it shows (a team ticked off the joker pick). Redundant when `shouldBroadcastState` is set. */
  shouldBroadcastDisplayState: boolean;
  /** Questions whose answer list the admin room needs afresh. */
  answerListQuestionIds: readonly number[];
  /** Ids of the teams whose team view may have changed; delivery sends each connected one a fresh team view. Listing an unchanged team only costs a send. */
  changedTeamIds: readonly number[];
  notices: readonly SocketNotice[];
  /** Sockets to disconnect, last of all, after the notices. */
  socketsToClose: readonly string[];
  /**
   * The new auto-lock deadlines, present only when the write that produced
   * this outcome changed either one. Only the Session write's commit step
   * (every write, including the held quiz edit) fills it, from a
   * before/after comparison of the stored session, so no event sets it by
   * hand; a write that moves a deadline must return an outcome or the commit
   * throws rather than drop the re-arm. The delivery step
   * re-arms the session's timers from it before any emit. A write that throws
   * reports nothing.
   */
  deadlineChange?: DeadlineChange;
  /**
   * True when the write may have changed a league table: the session entered
   * or left `ended`, or it was `ended` before and after and refreshed
   * standings. Like `deadlineChange`, only the Session write's commit step
   * sets it, from a before/after comparison of the stored session, so no event
   * sets it by hand. The delivery step then re-reads every other live
   * session's league top.
   */
  leagueTablesChanged?: boolean;
}

export const BROADCAST_STATE_OUTCOME: SessionOutcome = {
  replies: [],
  shouldBroadcastState: true,
  shouldBroadcastAdminState: false,
  shouldBroadcastDisplayState: false,
  answerListQuestionIds: [],
  changedTeamIds: [],
  notices: [],
  socketsToClose: [],
};

/** The outcome of a write that is only acknowledged, or dropped: no emits, no broadcast. */
export const NOTHING_TO_PUSH_OUTCOME: SessionOutcome = {
  ...BROADCAST_STATE_OUTCOME,
  shouldBroadcastState: false,
};

/** The team ids in any of `lists`, each once. */
export function unionTeamIds(...lists: Iterable<number>[]): number[] {
  return [...new Set(lists.flatMap((list) => [...list]))];
}

/** The ids of the teams with a phone connected right now. */
export function connectedTeamIds(session: SessionState): number[] {
  return Object.keys(session.connectedTeamSockets).map(Number);
}

/**
 * The syncs for those of `teamIds` that are connected right now, each with the
 * socket it is on, so delivery never has to look a team's socket up.
 */
export function connectedTeamSyncs(
  session: SessionState,
  teamIds: Iterable<number>,
): TeamSync[] {
  return [...teamIds].flatMap((teamId) => {
    const socketId = session.connectedTeamSockets[teamId];
    return socketId ? [{ teamId, socketId }] : [];
  });
}
