import type { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { buildAnswersUpdatedPayload } from '@/game/socket/answers-updated-payload.util';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { SessionOutcome } from '@/game/state/session-outcome';

/**
 * The one place a SessionOutcome becomes emits, always in the same order:
 * presenter context to admin, the state snapshot to all three rooms, admin
 * answer lists, per-team answer syncs, then per-socket notices.
 */
export async function deliverOutcome(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  outcome: SessionOutcome,
): Promise<void> {
  const { gameState, answerService, server } = deps;
  if (outcome.shouldBroadcastState) {
    broadcastGameState(server, joinCode, gameState);
  }

  for (const questionId of outcome.answerListQuestionIds) {
    const answers = await answerService.listForQuestion(
      gameState.getGameSessionId(joinCode),
      questionId,
    );
    server
      .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
      .emit(
        SOCKET_EVENTS.ANSWERS_UPDATED,
        buildAnswersUpdatedPayload(gameState, joinCode, questionId, answers),
      );
  }

  for (const teamId of outcome.teamSyncTeamIds) {
    const socketId = gameState.getConnectedSocketId(joinCode, teamId);
    if (!socketId) continue;
    const answers = await answerService.listForTeam(
      gameState.getGameSessionId(joinCode),
      teamId,
    );
    server.to(socketId).emit(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, { answers });
  }

  for (const notice of outcome.notices) {
    const target = server.to(notice.socketId);
    if (notice.payload === undefined) target.emit(notice.event);
    else target.emit(notice.event, notice.payload);
  }
}
