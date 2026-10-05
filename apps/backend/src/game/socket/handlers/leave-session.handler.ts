import type { LeaveSessionPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

/**
 * A team's own explicit "log out" — unlike a transport disconnect (which
 * only marks the team as not-currently-connected, so a phone that sleeps or
 * loses signal can reconnect and resume), this removes the roster row
 * outright. Without it, a team that logs out and rejoins under a new name
 * (the only way to "rename" a team today) leaves its old identity behind as
 * a stale entry in /control that the admin has to kick by hand.
 */
export function leaveSessionAsTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<LeaveSessionPayload>,
): Promise<EventResult> {
  return deps.gameState.teamLeft(joinCode, payload.teamId, client.id);
}
