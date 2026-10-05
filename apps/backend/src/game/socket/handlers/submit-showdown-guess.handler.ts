import type { SubmitShowdownGuessPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function submitShowdownGuess(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<SubmitShowdownGuessPayload>,
): Promise<EventResult> {
  return deps.gameState.submitShowdownGuess(joinCode, payload, client.id);
}
