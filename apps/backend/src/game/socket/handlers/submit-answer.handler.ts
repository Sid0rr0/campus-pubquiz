import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, type SubmitAnswerPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';

export async function submitTeamAnswer(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  client: Socket,
  joinCode: string,
  payload: SubmitAnswerPayload,
): Promise<void> {
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

  client.emit(SOCKET_EVENTS.ANSWER_RECEIVED, {
    questionId: payload.questionId,
    teamId: submitted.teamId,
    teamName: submitted.teamName,
    value: submitted.value,
    pointsAwarded: submitted.pointsAwarded,
    gradedAt: submitted.gradedAt,
  });

  await deliverOutcome(
    deps,
    joinCode,
    await deps.gameState.recordAnswer(joinCode, payload.questionId),
  );
}
