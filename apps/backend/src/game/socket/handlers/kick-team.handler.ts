import type { Server } from 'socket.io';
import { SOCKET_EVENTS, type KickTeamPayload } from '@campus-pubquiz/types';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { TeamService } from '@/team/team.service';

export async function kickTeamFromSession(
  deps: {
    gameState: GameStateService;
    teamService: TeamService;
    server: Server;
  },
  joinCode: string,
  payload: KickTeamPayload,
): Promise<void> {
  const socketId = deps.gameState.getConnectedSocketId(
    joinCode,
    payload.teamId,
  );
  if (socketId) {
    const targetSocket = deps.server.sockets.sockets.get(socketId);
    targetSocket?.emit(SOCKET_EVENTS.TEAM_KICKED);
    targetSocket?.disconnect(true);
    deps.gameState.clearTeamConnectionBySocketId(joinCode, socketId);
  }

  // Kicking removes the team from this session's roster outright — a
  // disconnected team has no live socket to boot, so disconnection alone
  // (the old behavior) was a no-op for it.
  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);

  const teams = await deps.teamService.listForSession(gameSessionId);
  deps.gameState.setTeams(joinCode, teams);
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
