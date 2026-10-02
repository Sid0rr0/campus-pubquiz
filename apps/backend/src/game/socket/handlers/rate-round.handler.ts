import { WsException } from '@nestjs/websockets';
import type { RateRoundPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

/**
 * A team rating one round of the break card. A plain team-scoped write
 * followed by the ack: it changes no session state, so it broadcasts nothing
 * and doesn't go through the session write.
 */
export async function rateRoundAsTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<RateRoundPayload>,
): Promise<EventResult> {
  const teamId = deps.gameState.getTeamIdForSocket(joinCode, client.id);
  if (teamId === null) {
    throw new WsException('Join a team before rating a round');
  }
  if (!deps.gameState.isRoundOpenForRating(joinCode, payload.roundId)) {
    throw new WsException("This round can't be rated right now");
  }

  await deps.feedbackService.rateRound(
    deps.gameState.getGameSessionId(joinCode),
    teamId,
    payload.roundId,
    payload.stars,
  );
  return undefined;
}
