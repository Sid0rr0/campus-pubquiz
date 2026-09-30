import type { GameStatus } from '@campus-pubquiz/types';

/** A direct emit to one socket (e.g. kicked, bonus awarded), delivered after every room push. */
export interface SocketNotice {
  socketId: string;
  event: string;
  payload: unknown;
}

/**
 * What the Live session module says must be pushed after it applies an event.
 * The socket layer's one delivery step turns this into emits, so no caller
 * decides for itself which rooms hear about a change.
 */
export interface SessionOutcome {
  /** Presenter context to admin, then the state snapshot to all three rooms. */
  shouldBroadcastState: boolean;
  /** Questions whose answer list the admin room needs afresh. */
  answerListQuestionIds: readonly number[];
  /** Connected teams whose own graded-answer list needs a per-team sync. */
  teamSyncTeamIds: readonly number[];
  notices: readonly SocketNotice[];
}

export const BROADCAST_STATE_OUTCOME: SessionOutcome = {
  shouldBroadcastState: true,
  answerListQuestionIds: [],
  teamSyncTeamIds: [],
  notices: [],
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
