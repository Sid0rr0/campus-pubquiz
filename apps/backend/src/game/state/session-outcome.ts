import {
  type GameStatus,
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
  typeof SOCKET_EVENTS.TEAM_KICKED | typeof SOCKET_EVENTS.BONUS_AWARDED
>;

/** A direct emit to the socket that sent the event (answer received, join accepted), delivered before any room push. */
export type SocketReply = EventEmit<
  typeof SOCKET_EVENTS.ANSWER_RECEIVED | typeof SOCKET_EVENTS.JOIN_ACCEPTED
>;

/** A connected team whose own graded-answer list needs a sync, with the socket it is on. */
export interface TeamSync {
  teamId: number;
  socketId: string;
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
  /** Questions whose answer list the admin room needs afresh. */
  answerListQuestionIds: readonly number[];
  /** Connected teams whose own graded-answer list needs a per-team sync. */
  teamSyncs: readonly TeamSync[];
  notices: readonly SocketNotice[];
  /** Sockets to disconnect, last of all, after the notices. */
  socketsToClose: readonly string[];
}

export const BROADCAST_STATE_OUTCOME: SessionOutcome = {
  replies: [],
  shouldBroadcastState: true,
  answerListQuestionIds: [],
  teamSyncs: [],
  notices: [],
  socketsToClose: [],
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
