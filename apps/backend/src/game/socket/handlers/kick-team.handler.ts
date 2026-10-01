import type { KickTeamPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function kickTeamFromSession(
  deps: EventServices,
  { joinCode, payload }: EventContext<KickTeamPayload>,
): Promise<EventResult> {
  const socketId = deps.gameState.getConnectedSocketId(
    joinCode,
    payload.teamId,
  );

  // Kicking removes the team from this session's roster outright — a
  // disconnected team has no live socket to boot, so disconnection alone
  // (the old behavior) was a no-op for it.
  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);
  const roster = await deps.teamService.listForSession(gameSessionId);

  const outcome = await deps.gameState.teamRemoved(
    joinCode,
    payload.teamId,
    roster,
    'kicked',
  );
  // After delivery, so the TEAM_KICKED notice is out before the socket closes.
  return {
    outcome,
    afterDelivery: () => {
      if (socketId) deps.server.sockets.sockets.get(socketId)?.disconnect(true);
    },
  };
}
