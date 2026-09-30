import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { GradeAnswerPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
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

  await deliverOutcome(
    deps,
    joinCode,
    await deps.gameState.answerGraded(joinCode, questionId),
  );
}
