import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';
import type { SubmitAnswerPayload } from '@campus-pubquiz/types';

export function submitTeamAnswer(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<SubmitAnswerPayload>,
): Promise<EventResult> {
  return deps.gameState.submitAnswer(joinCode, payload, client.id);
}
