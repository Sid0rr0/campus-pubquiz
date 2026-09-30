import type { Server } from 'socket.io';
import type { SetDisplayTextScalePayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';

export async function updateDisplayTextScale(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  payload: SetDisplayTextScalePayload,
): Promise<void> {
  await deliverOutcome(
    deps,
    joinCode,
    deps.gameState.displayTextScaleSet(joinCode, payload.displayTextScale),
  );
}
