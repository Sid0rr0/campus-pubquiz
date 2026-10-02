import { SOCKET_EVENTS, type KickTeamPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function kickTeamFromSession(
  deps: EventServices,
  { joinCode, payload }: EventContext<KickTeamPayload>,
): Promise<EventResult> {
  // Kicking removes the team from this session's roster outright — a
  // disconnected team has no live socket to boot, so disconnection alone
  // (the old behavior) was a no-op for it.
  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);

  const outcome = await deps.gameState.teamRemoved(
    joinCode,
    payload.teamId,
    () => deps.teamService.listForSession(gameSessionId),
    'kicked',
  );
  // The socket the notice went to is the one to close, so the two can't diverge.
  const socketId = outcome.notices.find(
    (notice) => notice.event === SOCKET_EVENTS.TEAM_KICKED,
  )?.socketId;
  // After delivery, so the TEAM_KICKED notice is out before the socket closes.
  return {
    outcome,
    afterDelivery: () => {
      if (socketId) deps.server.sockets.sockets.get(socketId)?.disconnect(true);
    },
  };
}
