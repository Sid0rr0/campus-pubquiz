import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type GradeAnswerPayload,
} from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { buildAnswersUpdatedPayload } from '@/game/socket/answers-updated-payload.util';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';

export async function gradeTeamAnswer(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  payload: GradeAnswerPayload,
): Promise<void> {
  const gameSessionId = deps.gameState.getGameSessionId(joinCode);

  let questionId: number;
  try {
    ({ questionId } = await deps.answerService.grade(
      gameSessionId,
      payload.answerId,
      payload.pointsAwarded,
    ));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to grade answer';
    throw new WsException(message);
  }

  const answers = await deps.answerService.listForQuestion(
    gameSessionId,
    questionId,
  );
  deps.server
    .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
    .emit(
      SOCKET_EVENTS.ANSWERS_UPDATED,
      buildAnswersUpdatedPayload(deps.gameState, joinCode, questionId, answers),
    );

  const leaderboard =
    await deps.answerService.computeLeaderboard(gameSessionId);
  deps.gameState.setLeaderboard(joinCode, leaderboard);
  deps.gameState.setQuestionGradedStatus(
    joinCode,
    questionId,
    answers.some((answer) => answer.gradedAt === null),
  );

  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
