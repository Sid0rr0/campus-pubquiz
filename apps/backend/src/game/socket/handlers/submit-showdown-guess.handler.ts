import { WsException } from '@nestjs/websockets';
import type { SubmitShowdownGuessPayload } from '@campus-pubquiz/types';
import { InvalidShowdownError } from '@/showdown/showdown.service';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function submitShowdownGuess(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<SubmitShowdownGuessPayload>,
): Promise<EventResult> {
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

  return deps.gameState.showdownGuessSubmitted(
    joinCode,
    payload.teamId,
    payload.value,
  );
}
