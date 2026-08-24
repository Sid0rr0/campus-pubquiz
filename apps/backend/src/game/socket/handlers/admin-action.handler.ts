import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { GameAction, StateSnapshotPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';
import { syncTeamAnswersOnRevealEntry } from '@/game/socket/reveal-entry-sync.util';

export async function applyAdminAction(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  action: GameAction,
): Promise<void> {
  const previousStatus = deps.gameState.getSnapshot(joinCode).progress.status;
  let snapshot: StateSnapshotPayload;
  try {
    snapshot = await deps.gameState.applyAction(joinCode, action);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid game action';
    throw new WsException(message);
  }

  // The leaderboard otherwise only refreshes on GRADE_ANSWER, so toggling
  // it on before any grading has happened would show nothing — recompute
  // fresh here so every currently-joined team appears, 0 points and all.
  if (
    action === 'TOGGLE_LEADERBOARD' &&
    snapshot.progress.isLeaderboardVisible
  ) {
    const leaderboard = await deps.answerService.computeLeaderboard(
      deps.gameState.getGameSessionId(joinCode),
    );
    deps.gameState.setLeaderboard(joinCode, leaderboard);
    snapshot = deps.gameState.getSnapshot(joinCode);
  }

  await syncTeamAnswersOnRevealEntry(
    deps,
    joinCode,
    previousStatus,
    snapshot.progress.status,
  );

  broadcastGameState(deps.server, joinCode, snapshot);
}
