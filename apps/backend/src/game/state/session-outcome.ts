import {
  type GameStatus,
  type ServerToClientProtocol,
  type SessionState,
  SOCKET_EVENTS,
  type TeamJoker,
} from '@campus-pubquiz/types';

/** One server-to-client event paired with its protocol payload, so a mismatched pair doesn't compile. An event that carries no payload (`TEAM_KICKED`) takes `undefined`. */
type EventEmit<E extends keyof ServerToClientProtocol> =
  E extends keyof ServerToClientProtocol
    ? { event: E; payload: ServerToClientProtocol[E] }
    : never;

/** A direct emit to one socket (kicked, bonus awarded), delivered after every room push. */
export type SocketNotice = { socketId: string } & EventEmit<
  typeof SOCKET_EVENTS.TEAM_KICKED | typeof SOCKET_EVENTS.BONUS_AWARDED
>;

/** A direct emit to the socket that sent the event (answer received, join accepted), delivered before any room push. */
export type SocketReply = EventEmit<
  typeof SOCKET_EVENTS.ANSWER_RECEIVED | typeof SOCKET_EVENTS.JOIN_ACCEPTED
>;

/** A connected team whose own graded-answer or bonus award list needs a sync, with the socket it is on. */
export interface TeamSync {
  teamId: number;
  socketId: string;
}

/** A connected team whose phone needs its new player count, with the socket it is on. */
export interface PlayerCountSync extends TeamSync {
  playerCount: number;
}

/** A connected team whose phone needs its joker (null: none), with the socket it is on. */
export interface JokerSync extends TeamSync {
  joker: TeamJoker | null;
}

/** The session's phase timer deadlines (epoch-ms, or null when none is due) after a write that moved any of them. */
export interface DeadlineChange {
  questionLockAt: number | null;
  kahootQuestionEndsAt: number | null;
  jokerPickEndsAt: number | null;
}

/** The phase timer deadlines of a session, the one place the set is built. */
export function deadlinesOf(session: DeadlineChange): DeadlineChange {
  return {
    questionLockAt: session.questionLockAt,
    kahootQuestionEndsAt: session.kahootQuestionEndsAt,
    jokerPickEndsAt: session.jokerPickEndsAt,
  };
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
  /** Connected teams whose own graded-answer list needs a per-team sync. */
  teamSyncs: readonly TeamSync[];
  /** Connected teams whose own player count changed, each told its new number (never sent room-wide). */
  playerCountSyncs: readonly PlayerCountSync[];
  /** Connected teams whose own joker changed (a pick, a draw when the pick closed), each told the joker it now holds (never sent room-wide). */
  jokerSyncs: readonly JokerSync[];
  /** Connected teams whose own bonus award list changed under them (an award edited or deleted), each told its full list; a fresh award is a notice instead. */
  bonusSyncs: readonly TeamSync[];
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
  teamSyncs: [],
  playerCountSyncs: [],
  jokerSyncs: [],
  bonusSyncs: [],
  notices: [],
  socketsToClose: [],
};

/** The outcome of a write that is only acknowledged, or dropped: no emits, no broadcast. */
export const NOTHING_TO_PUSH_OUTCOME: SessionOutcome = {
  ...BROADCAST_STATE_OUTCOME,
  shouldBroadcastState: false,
};

/**
 * Whether a transition is the one moment a team's cached grades go stale:
 * entering reveal_intro, or kahoot's collapsed lock-to-reveal, which skips
 * reveal_intro but is where ensureKahootSpeedScored rescales points.
 */
export function isRevealEntry(
  previousStatus: GameStatus,
  newStatus: GameStatus,
): boolean {
  const entersRevealIntro =
    previousStatus !== 'reveal_intro' && newStatus === 'reveal_intro';
  const entersCollapsedKahootReveal =
    previousStatus === 'locking' && newStatus === 'reveal';
  return entersRevealIntro || entersCollapsedKahootReveal;
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
