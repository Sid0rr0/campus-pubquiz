import type { Server, Socket } from 'socket.io';
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
 * replies to the sender, presenter context to admin, the state snapshot to
 * all three rooms, admin answer lists, per-team answer syncs, per-socket
 * notices, then the sockets to close. The closes run even if an earlier step
 * fails, since the event was already applied by then. `sender` is
 * absent for events no socket sent (timer expiries), which have no replies.
 */
export async function deliverOutcome(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  outcome: SessionOutcome,
  sender?: Pick<Socket, 'emit'>,
): Promise<void> {
  const { server } = deps;
  try {
    await deliverEmits(deps, joinCode, outcome, sender);
  } finally {
    for (const socketId of outcome.socketsToClose) {
      server.sockets.sockets.get(socketId)?.disconnect(true);
    }
  }
}

async function deliverEmits(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  outcome: SessionOutcome,
  sender: Pick<Socket, 'emit'> | undefined,
): Promise<void> {
  const { gameState, answerService, server } = deps;
  for (const reply of outcome.replies) {
    sender?.emit(reply.event, reply.payload);
  }
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

  for (const { teamId, socketId } of outcome.teamSyncs) {
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
