import type { GradeAnswerPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export function gradeTeamAnswer(
  deps: EventServices,
  { joinCode, payload }: EventContext<GradeAnswerPayload>,
): Promise<EventResult> {
  return deps.gameState.gradeAnswer(
    joinCode,
    payload.answerId,
    payload.pointsAwarded,
  );
}
