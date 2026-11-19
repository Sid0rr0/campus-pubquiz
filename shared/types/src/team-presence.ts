import type { OwnTeamView } from './team-view';

export interface JoinPlayersPayload {
  teamName: string;
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
  /** The socket id this device held the team on before an auto-reconnect — lets the server hand the team over from that stale socket (still "live" until its ping timeout notices it's dead) instead of rejecting the rejoin as a second device. */
  previousSocketId?: string;
}

/** What the server refuses a submitted answer with when the sending socket doesn't hold the team's seat. */
export const NOT_YOUR_TEAM_ANSWER_ERROR =
  'You may only submit answers for your own team';

/** The part of the "team already connected" join refusal that is the same whatever the team's name. */
export const SEAT_TAKEN_REFUSAL_MARKER =
  'is already connected on another device';

/** Whether a join refusal says another live socket holds the team's seat — it clears once the server notices that socket is dead. */
export function isSeatTakenRefusal(error: string): boolean {
  return error.includes(SEAT_TAKEN_REFUSAL_MARKER);
}

export interface JoinAcceptedPayload {
  teamId: number;
  teamToken: string;
  teamCode: string;
  teamName: string;
  /** Everything else the team's phone knows about it, built by the projection that also feeds the live updates. */
  teamView: OwnTeamView;
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
