import {
  revealOnAir,
  type ActiveShowdownRoundState,
  type SessionState,
} from '@campus-pubquiz/types';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';

/**
 * Seat lookups and the session updates that carry a rule. Internal to the Live
 * session module: one-field updates are written inline by the change module
 * that makes them.
 */

/** The session with `teamId`'s player count cached; a null count (none reported) leaves the cache as it was. */
export function withPlayerCount(
  session: SessionState,
  teamId: number,
  playerCount: number | null,
): SessionState {
  return playerCount === null
    ? session
    : {
        ...session,
        playerCounts: { ...session.playerCounts, [teamId]: playerCount },
      };
}

/** The team whose seat `socketId` holds, or null. */
export function seatOfSocket(
  session: SessionState,
  socketId: string,
): number | null {
  const entry = Object.entries(session.connectedTeamSockets).find(
    ([, connectedSocketId]) => connectedSocketId === socketId,
  );
  return entry ? Number(entry[0]) : null;
}

/**
 * The team id a team event acts for, refusing with `refusal` unless `socketId`
 * holds a seat (and, when the event names `claimedTeamId`, that team's seat).
 * Every team event checks its seat through this, never the connected sockets.
 */
export function requireSeat(
  session: SessionState,
  socketId: string,
  refusal: string,
  claimedTeamId?: number,
): number {
  // Compare the claimed seat directly: a socket can hold two seats, and the
  // first one `seatOfSocket` finds may not be the claimed team's.
  const teamId =
    claimedTeamId === undefined
      ? seatOfSocket(session, socketId)
      : session.connectedTeamSockets[claimedTeamId] === socketId
        ? claimedTeamId
        : null;
  if (teamId === null) throw new SessionRefusal(refusal);
  return teamId;
}

/** Sets/replaces the in-progress showdown round — including sudden death's fresh round. A round that is the reveal on air starts at its first step; one composed while another reveal is on air leaves that reveal's step alone. */
export function withActiveShowdownRound(
  session: SessionState,
  round: ActiveShowdownRoundState,
): SessionState {
  const withRound = { ...session, activeShowdownRound: round };
  return revealOnAir(withRound)?.reveal === 'showdown'
    ? { ...withRound, revealStep: 0 }
    : withRound;
}
