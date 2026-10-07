import type { RateRoundPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function rateRoundAsTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<RateRoundPayload>,
): Promise<EventResult> {
  return deps.gameState.roundRated(joinCode, payload, client.id);
}
