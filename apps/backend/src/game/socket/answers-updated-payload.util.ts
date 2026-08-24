import { WsException } from '@nestjs/websockets';
import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import type { GameStateService } from '@/game/state/game-state.service';

/** Builds the ANSWERS_UPDATED payload for one question, throwing a client-safe WsException if the question is unknown. */
export function buildAnswersUpdatedPayload(
  gameState: GameStateService,
  joinCode: string,
  questionId: number,
  answers: AnswersUpdatedPayload['answers'],
): AnswersUpdatedPayload {
  const question = gameState.getAdminQuestionContext(joinCode, questionId);
  if (!question) {
    throw new WsException(`Unknown question ${questionId}`);
  }
  return { questionId, question, answers };
}
