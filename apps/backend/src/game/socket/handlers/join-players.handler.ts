import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, type JoinPlayersPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import type { BonusService } from '@/bonus/bonus.service';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { TeamService } from '@/team/team.service';

export async function joinPlayerTeam(
  deps: {
    gameState: GameStateService;
    teamService: TeamService;
    answerService: AnswerService;
    bonusService: BonusService;
    server: Server;
  },
  client: Socket,
  joinCode: string,
  payload: JoinPlayersPayload,
): Promise<void> {
  try {
    const team = await deps.teamService.join(
      deps.gameState.getGameSessionId(joinCode),
      payload.teamName,
      {
        teamToken: payload.teamToken,
        teamCode: payload.teamCode,
        joinCode: payload.joinCode,
      },
    );

    const existingSocketId = deps.gameState.getConnectedSocketId(
      joinCode,
      team.id,
    );
    const isLiveElsewhere =
      existingSocketId &&
      existingSocketId !== client.id &&
      deps.server.sockets.sockets.get(existingSocketId)?.connected;
    if (isLiveElsewhere) {
      throw new WsException(
        `"${team.name}" is already connected on another device — ask the quiz master to remove it, then try again.`,
      );
    }
    deps.gameState.setTeamConnected(joinCode, team.id, client.id);

    const savedAnswers = await deps.answerService.listForTeam(
      deps.gameState.getGameSessionId(joinCode),
      team.id,
    );
    const savedBonusAwards = await deps.bonusService.listForTeam(
      deps.gameState.getGameSessionId(joinCode),
      team.id,
    );
    client.emit(SOCKET_EVENTS.JOIN_ACCEPTED, {
      teamId: team.id,
      teamName: team.name,
      teamToken: team.token,
      teamCode: team.code,
      answers: savedAnswers,
      bonusAwards: savedBonusAwards,
    });

    const teams = await deps.teamService.listForSession(
      deps.gameState.getGameSessionId(joinCode),
    );
    deps.gameState.setTeams(joinCode, teams);
    broadcastGameState(
      deps.server,
      joinCode,
      deps.gameState.getSnapshot(joinCode),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join';
    throw new WsException(message);
  }
}
