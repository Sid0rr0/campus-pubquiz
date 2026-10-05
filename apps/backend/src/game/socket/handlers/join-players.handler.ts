import type { JoinPlayersPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function joinPlayerTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<JoinPlayersPayload>,
): Promise<EventResult> {
  return deps.gameState.teamJoined(
    joinCode,
    payload,
    client.id,
    (socketId) => deps.server.sockets.sockets.get(socketId)?.connected ?? false,
  );
}
