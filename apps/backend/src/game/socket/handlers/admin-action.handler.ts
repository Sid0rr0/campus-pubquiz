import type { GameServer } from '@/game/socket/game-socket.types';
import type { GameAction } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';

interface AdminActionDeps {
  gameState: GameStateService;
  answerService: AnswerService;
  server: GameServer;
}

/**
 * Applies one action and delivers its outcome. Both auto-lock timer expiries
 * go through here, so a timer-driven lock is indistinguishable from the quiz
 * master pressing Advance. Rejects with the module's refusal (illegal
 * transition, ungraded answers).
 */
export async function runAdminAction(
  deps: AdminActionDeps,
  joinCode: string,
  action: GameAction,
): Promise<void> {
  await deliverOutcome(
    deps,
    joinCode,
    await deps.gameState.applyAdminAction(joinCode, action),
  );
}
