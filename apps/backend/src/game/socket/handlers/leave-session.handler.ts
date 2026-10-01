import { WsException } from '@nestjs/websockets';
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
export async function leaveSessionAsTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<LeaveSessionPayload>,
): Promise<EventResult> {
  const connectedSocketId = deps.gameState.getConnectedSocketId(
    joinCode,
    payload.teamId,
  );
  if (connectedSocketId !== client.id) {
    throw new WsException('Can only leave the session as your own team');
  }

  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);
  const roster = await deps.teamService.listForSession(gameSessionId);

  return await deps.gameState.teamRemoved(
    joinCode,
    payload.teamId,
    roster,
    'left',
  );
}
