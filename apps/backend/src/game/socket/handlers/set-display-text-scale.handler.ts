import type { Server } from 'socket.io';
import type { SetDisplayTextScalePayload } from '@campus-pubquiz/types';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';

export function updateDisplayTextScale(
  deps: { gameState: GameStateService; server: Server },
  joinCode: string,
  payload: SetDisplayTextScalePayload,
): void {
  deps.gameState.setDisplayTextScale(joinCode, payload.displayTextScale);
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
