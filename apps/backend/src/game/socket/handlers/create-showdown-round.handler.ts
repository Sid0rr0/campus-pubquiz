import type { CreateShowdownRoundPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function createShowdownRound(
  deps: EventServices,
  { joinCode, payload }: EventContext<CreateShowdownRoundPayload>,
): Promise<EventResult> {
  return deps.gameState.createShowdownRound(joinCode, payload);
}
