import type { Server } from 'socket.io';
import { SOCKET_EVENTS, type GameStatus } from '@campus-pubquiz/types';
import type { GameStateService } from '@/game/state/game-state.service';
import type { AnswerService } from '@/answer/answer.service';

/**
 * Pushes each currently-connected team its own up-to-date graded answers
 * the moment the block they answered first reaches 'reveal_intro' — by
 * then every answer should be graded (auto-graded at submit, or manually
 * by the admin sometime during the break screens beforehand), so this is
 * the one moment a connected team's local state needs refreshing to show
 * accurate points once reveal renders them. Fires once per entry into
 * reveal, not on every ADVANCE while already revealing.
 */
export async function syncTeamAnswersOnRevealEntry(
  deps: {
    gameState: GameStateService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  previousStatus: GameStatus,
  newStatus: GameStatus,
): Promise<void> {
  if (previousStatus === 'reveal_intro' || newStatus !== 'reveal_intro') {
    return;
  }

  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  const { teams } = deps.gameState.getSnapshot(joinCode);
  for (const team of teams) {
    if (!team.isConnected) continue;
    const socketId = deps.gameState.getConnectedSocketId(joinCode, team.teamId);
    if (!socketId) continue;
    const answers = await deps.answerService.listForTeam(
      gameSessionId,
      team.teamId,
    );
    deps.server
      .to(socketId)
      .emit(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, { answers });
  }
}
