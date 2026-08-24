import type { Server } from 'socket.io';
import type { SetBreakEndTimePayload } from '@campus-pubquiz/types';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';

export function updateBreakEndTime(
  deps: { gameState: GameStateService; server: Server },
  joinCode: string,
  payload: SetBreakEndTimePayload,
): void {
  deps.gameState.setBreakEndTime(joinCode, payload.breakEndsAt);
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
