import { WsException } from '@nestjs/websockets';
import type { AwardBonusPayload } from '@campus-pubquiz/types';
import { InvalidBonusAwardError } from '@/bonus/bonus.service';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function awardTeamBonus(
  deps: EventServices,
  { joinCode, payload }: EventContext<AwardBonusPayload>,
): Promise<EventResult> {
  try {
    await deps.bonusService.award(
      deps.gameState.getGameSessionId(joinCode),
      payload.teamId,
      payload.category,
      payload.points,
      payload.reason,
      deps.gameState.getSessionSettings(joinCode).enabledBonusCategories,
      deps.gameState.getSessionSettings(joinCode).maxBonusAwardsPerCategory,
    );
  } catch (error) {
    if (error instanceof InvalidBonusAwardError) {
      throw new WsException(error.message);
    }
    throw error;
  }

  return await deps.gameState.bonusChanged(joinCode, {
    teamId: payload.teamId,
    notice: {
      category: payload.category,
      points: payload.points,
      reason: payload.reason,
    },
  });
}
