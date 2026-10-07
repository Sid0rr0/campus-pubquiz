import type { TeamAnswerView } from './answers';
import type { TeamBonusAwardView } from './bonus';
import type { RoundRatingView, TeamFeedbackView } from './feedback';

export interface JoinPlayersPayload {
  teamName: string;
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
  /** The socket id this device held the team on before an auto-reconnect — lets the server hand the team over from that stale socket (still "live" until its ping timeout notices it's dead) instead of rejecting the rejoin as a second device. */
  previousSocketId?: string;
}

export interface JoinAcceptedPayload {
  teamId: number;
  teamToken: string;
  teamCode: string;
  teamName: string;
  /** The team's saved answers in this session, so reconnects restore them. */
  answers: TeamAnswerView[];
  /** The team's own bonus awards so far this session, so reconnects restore them. */
  bonusAwards: TeamBonusAwardView[];
  /** The team's own saved round ratings this session, so a reconnecting phone shows its stars again. */
  roundRatings: RoundRatingView[];
  /** The team's own saved comment and topic suggestions this session (empty when it sent none), so a reconnecting phone shows its final form again. */
  feedback: TeamFeedbackView;
}

export interface KickTeamPayload {
  teamId: number;
}

/**
 * A team's own explicit "log out" — the app has no dedicated rename feature,
 * so changing a team's display name means logging out and rejoining under a
 * new name. Without this, the old identity's roster row lingers in
 * TeamView/`/control` until an admin kicks it by hand; sending this first
 * removes it automatically, mirroring what KICK_TEAM does server-side minus
 * the forced disconnect (the caller is already leaving on its own).
 */
export interface LeaveSessionPayload {
  teamId: number;
}

/** Broadcast to a session's players room once its admin closes it — the session no longer exists server-side, so the client should drop its identity and return to the join screen. */
export interface SessionClosedPayload {
  joinCode: string;
}
