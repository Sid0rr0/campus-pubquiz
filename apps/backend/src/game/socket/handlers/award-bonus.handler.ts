import type { AwardBonusPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function awardTeamBonus(
  deps: EventServices,
  { joinCode, payload }: EventContext<AwardBonusPayload>,
): Promise<EventResult> {
  return deps.gameState.awardBonus(joinCode, payload);
}
