import type { KickTeamPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function kickTeamFromSession(
  deps: EventServices,
  { joinCode, payload }: EventContext<KickTeamPayload>,
): Promise<EventResult> {
  return deps.gameState.kickTeam(joinCode, payload.teamId);
}
