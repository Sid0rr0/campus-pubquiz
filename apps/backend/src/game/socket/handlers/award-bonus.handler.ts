import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { SOCKET_EVENTS, type AwardBonusPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
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

  const awardedTeamSocketId = deps.gameState.getConnectedSocketId(
    joinCode,
    payload.teamId,
  );
  if (awardedTeamSocketId) {
    deps.server.to(awardedTeamSocketId).emit(SOCKET_EVENTS.BONUS_AWARDED, {
      category: payload.category,
      points: payload.points,
      reason: payload.reason,
    });
  }

  const leaderboard = await deps.answerService.computeLeaderboard(
    deps.gameState.getGameSessionId(joinCode),
  );
  deps.gameState.setLeaderboard(joinCode, leaderboard);
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
