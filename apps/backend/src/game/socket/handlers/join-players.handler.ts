import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, type JoinPlayersPayload } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import type { BonusService } from '@/bonus/bonus.service';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
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
    const existingSocket =
      existingSocketId && existingSocketId !== client.id
        ? deps.server.sockets.sockets.get(existingSocketId)
        : undefined;
    if (existingSocket?.connected) {
      // This same device auto-reconnecting on a fresh socket before our ping
      // timeout noticed its old one died (network switch, phone waking up).
      // Socket ids are random and never shared with other clients, so only
      // the device that actually held that socket can name it here.
      if (payload.previousSocketId !== existingSocketId) {
        throw new WsException(
          `"${team.name}" is already connected on another device — ask the quiz master to remove it, then try again.`,
        );
      }
      existingSocket.disconnect(true);
    }
    const teams = await deps.teamService.listForSession(
      deps.gameState.getGameSessionId(joinCode),
    );
    const outcome = deps.gameState.teamConnected(
      joinCode,
      team.id,
      client.id,
      teams,
    );

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

    await deliverOutcome(deps, joinCode, outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join';
    throw new WsException(message);
  }
}
