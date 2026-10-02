import { WsException } from '@nestjs/websockets';
import type { SendFeedbackPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

/**
 * A team sending its comment and topic suggestions from the final form. Like
 * rating a round, a plain team-scoped write followed by the ack: it changes no
 * session state, so it broadcasts nothing and doesn't go through the session
 * write. The payload arrives already validated and cleaned by its schema.
 */
export async function sendFeedbackAsTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<SendFeedbackPayload>,
): Promise<EventResult> {
  const teamId = deps.gameState.getTeamIdForSocket(joinCode, client.id);
  if (teamId === null) {
    throw new WsException('Join a team before sending feedback');
  }
  if (!deps.gameState.isFinalFormOpen(joinCode)) {
    throw new WsException("Feedback can't be sent right now");
  }

  await deps.feedbackService.sendFeedback(
    deps.gameState.getGameSessionId(joinCode),
    teamId,
    { comment: payload.comment, topics: payload.topics },
  );
  return undefined;
}
