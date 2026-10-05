import { WsException } from '@nestjs/websockets';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';
import { SOCKET_EVENTS, type SubmitAnswerPayload } from '@campus-pubquiz/types';

export async function submitTeamAnswer(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<SubmitAnswerPayload>,
): Promise<EventResult> {
  if (
    !deps.gameState.isQuestionOpenForAnswering(joinCode, payload.questionId)
  ) {
    throw new WsException('Answers are locked for this question');
  }

  if (
    deps.gameState.getConnectedSocketId(joinCode, payload.teamId) !== client.id
  ) {
    throw new WsException('You may only submit answers for your own team');
  }

  const phaseStartedAt = deps.gameState.getPhaseStartedAt(joinCode);
  const responseMs =
    phaseStartedAt === null ? null : Date.now() - phaseStartedAt;

  const submitted = await deps.answerService.submit(
    deps.gameState.getGameSessionId(joinCode),
    payload.questionId,
    payload.teamId,
    payload.value,
    responseMs,
  );

  const outcome = await deps.gameState.recordAnswer(
    joinCode,
    payload.questionId,
  );
  return {
    ...outcome,
    replies: [
      {
        event: SOCKET_EVENTS.ANSWER_RECEIVED,
        payload: {
          questionId: payload.questionId,
          teamId: submitted.teamId,
          teamName: submitted.teamName,
          value: submitted.value,
          pointsAwarded: submitted.pointsAwarded,
          gradedAt: submitted.gradedAt,
          verdict: submitted.verdict,
        },
      },
    ],
  };
}
