import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { buildAnswersUpdatedPayload } from '@/game/socket/answers-updated-payload.util';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
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

  const submitted = await deps.answerService.submit(
    deps.gameState.getGameSessionId(joinCode),
    payload.questionId,
    payload.teamId,
    payload.value,
  );

  client.emit(SOCKET_EVENTS.ANSWER_RECEIVED, {
    questionId: payload.questionId,
    teamId: submitted.teamId,
    teamName: submitted.teamName,
    value: submitted.value,
    pointsAwarded: submitted.pointsAwarded,
    gradedAt: submitted.gradedAt,
  });

  const answers = await deps.answerService.listForQuestion(
    deps.gameState.getGameSessionId(joinCode),
    payload.questionId,
  );
  deps.server
    .to(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))
    .emit(
      SOCKET_EVENTS.ANSWERS_UPDATED,
      buildAnswersUpdatedPayload(
        deps.gameState,
        joinCode,
        payload.questionId,
        answers,
      ),
    );

  deps.gameState.setAnsweredTeamIds(
    joinCode,
    payload.questionId,
    answers.map((answer) => answer.teamId),
  );
  deps.gameState.setQuestionGradedStatus(
    joinCode,
    payload.questionId,
    answers.some((answer) => answer.gradedAt === null),
  );
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
