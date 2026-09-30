import type { Server } from 'socket.io';
import type { KickTeamPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { TeamService } from '@/team/team.service';

export async function kickTeamFromSession(
  deps: {
    gameState: GameStateService;
    teamService: TeamService;
    answerService: AnswerService;
    server: Server;
  },
  joinCode: string,
  payload: KickTeamPayload,
): Promise<void> {
  const socketId = deps.gameState.getConnectedSocketId(
    joinCode,
    payload.teamId,
  );

  // Kicking removes the team from this session's roster outright — a
  // disconnected team has no live socket to boot, so disconnection alone
  // (the old behavior) was a no-op for it.
  const gameSessionId = deps.gameState.getGameSessionId(joinCode);
  await deps.teamService.removeFromRoster(gameSessionId, payload.teamId);
  const roster = await deps.teamService.listForSession(gameSessionId);

  await deliverOutcome(
    deps,
    joinCode,
    await deps.gameState.teamRemoved(
      joinCode,
      payload.teamId,
      roster,
      'kicked',
    ),
  );

  // After delivery, so the TEAM_KICKED notice is out before the socket closes.
  if (socketId) deps.server.sockets.sockets.get(socketId)?.disconnect(true);
}
