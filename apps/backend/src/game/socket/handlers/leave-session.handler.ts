import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { LeaveSessionPayload } from '@campus-pubquiz/types';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { TeamService } from '@/team/team.service';

/**
 * A team's own explicit "log out" — unlike a transport disconnect (which
 * only marks the team as not-currently-connected, so a phone that sleeps or
 * loses signal can reconnect and resume), this removes the roster row
 * outright. Without it, a team that logs out and rejoins under a new name
 * (the only way to "rename" a team today) leaves its old identity behind as
 * a stale entry in /control that the admin has to kick by hand.
 */
export async function leaveSessionAsTeam(
  deps: {
    gameState: GameStateService;
    teamService: TeamService;
    server: Server;
  },
  joinCode: string,
  callerSocketId: string,
  payload: LeaveSessionPayload,
): Promise<void> {
  const connectedSocketId = deps.gameState.getConnectedSocketId(
    joinCode,
    payload.teamId,
  );
  if (connectedSocketId !== callerSocketId) {
    throw new WsException('Can only leave the session as your own team');
  }

  deps.gameState.clearTeamConnectionBySocketId(joinCode, callerSocketId);

  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);

  const teams = await deps.teamService.listForSession(gameSessionId);
  deps.gameState.setTeams(joinCode, teams);
  broadcastGameState(deps.server, joinCode, deps.gameState);
}
