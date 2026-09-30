import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { SubmitShowdownGuessPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';
import {
  InvalidShowdownError,
  ShowdownService,
} from '@/showdown/showdown.service';

export async function submitShowdownGuess(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    showdownService: ShowdownService;
    server: Server;
  },
  client: Socket,
  joinCode: string,
  payload: SubmitShowdownGuessPayload,
): Promise<void> {
  const activeRound = deps.gameState.getActiveShowdownRound(joinCode);
  if (
    !activeRound ||
    activeRound.id !== payload.showdownRoundId ||
    activeRound.resolved ||
    deps.gameState.getShowdownRevealStep(joinCode) !== 0
  ) {
    throw new WsException('This showdown round is no longer accepting guesses');
  }

  if (
    deps.gameState.getConnectedSocketId(joinCode, payload.teamId) !== client.id
  ) {
    throw new WsException('You may only submit guesses for your own team');
  }

  const isParticipant = activeRound.participants.some(
    (participant) => participant.teamId === payload.teamId,
  );
  if (!isParticipant) {
    throw new WsException('Your team is not part of this showdown round');
  }

  try {
    await deps.showdownService.submitGuess(
      payload.showdownRoundId,
      payload.teamId,
      payload.value,
    );
  } catch (error) {
    if (error instanceof InvalidShowdownError) {
      throw new WsException(error.message);
    }
    throw error;
  }

  await deliverOutcome(
    deps,
    joinCode,
    deps.gameState.showdownGuessSubmitted(
      joinCode,
      payload.teamId,
      payload.value,
    ),
  );
}
