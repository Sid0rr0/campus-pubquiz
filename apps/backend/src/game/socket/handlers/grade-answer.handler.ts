import { WsException } from '@nestjs/websockets';
import type { GradeAnswerPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function gradeTeamAnswer(
  deps: EventServices,
  { joinCode, payload }: EventContext<GradeAnswerPayload>,
): Promise<EventResult> {
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

  return await deps.gameState.answerGraded(joinCode, questionId);
}
