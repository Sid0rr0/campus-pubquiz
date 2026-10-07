import type { SendFeedbackPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function sendFeedbackAsTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<SendFeedbackPayload>,
): Promise<EventResult> {
  return deps.gameState.feedbackSent(joinCode, payload, client.id);
}
