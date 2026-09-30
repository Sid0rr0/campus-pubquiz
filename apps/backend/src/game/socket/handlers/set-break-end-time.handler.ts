import type { Server } from 'socket.io';
import type { SetBreakEndTimePayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';

export async function updateBreakEndTime(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  payload: SetBreakEndTimePayload,
): Promise<void> {
  await deliverOutcome(
    deps,
    joinCode,
    deps.gameState.breakEndTimeSet(joinCode, payload.breakEndsAt),
  );
}
