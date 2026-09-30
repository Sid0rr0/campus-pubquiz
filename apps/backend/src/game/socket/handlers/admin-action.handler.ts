import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { GameAction } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';

interface AdminActionDeps {
  gameState: GameStateService;
  answerService: AnswerService;
  server: Server;
}

/**
 * Applies one action and delivers its outcome. The admin's ADVANCE and both
 * auto-lock timer expiries all go through here, so a timer-driven lock is
 * indistinguishable from the quiz master pressing Advance. Rejects with the
 * state machine's own message (illegal transition, ungraded answers).
 */
export async function runAdminAction(
  deps: AdminActionDeps,
  joinCode: string,
  action: GameAction,
): Promise<void> {
  const outcome = await deps.gameState
    .applyAdminAction(joinCode, action)
    .catch((error: unknown) => {
      throw new WsException(
        error instanceof Error ? error.message : 'Invalid game action',
      );
    });
  await deliverOutcome(deps, joinCode, outcome);
}
