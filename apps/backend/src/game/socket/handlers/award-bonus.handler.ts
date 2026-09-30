import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { AwardBonusPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';

export async function awardTeamBonus(
  deps: {
    gameState: GameStateService;
    bonusService: BonusService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  payload: AwardBonusPayload,
): Promise<void> {
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

  await deliverOutcome(
    deps,
    joinCode,
    await deps.gameState.bonusChanged(joinCode, {
      teamId: payload.teamId,
      notice: {
        category: payload.category,
        points: payload.points,
        reason: payload.reason,
      },
    }),
  );
}
