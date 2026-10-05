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
  // Kicking removes the team from this session's roster outright — a
  // disconnected team has no live socket to boot, so disconnection alone
  // (the old behavior) was a no-op for it. The outcome carries the kicked
  // notice and the socket to close, which delivery sends last.
  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);

  return await deps.gameState.teamRemoved(
    joinCode,
    payload.teamId,
    () => deps.teamService.listForSession(gameSessionId),
    'kicked',
  );
}
