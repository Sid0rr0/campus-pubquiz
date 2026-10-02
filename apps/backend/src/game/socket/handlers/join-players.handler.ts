import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, type JoinPlayersPayload } from '@campus-pubquiz/types';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function joinPlayerTeam(
  deps: EventServices,
  { joinCode, payload, client }: EventContext<JoinPlayersPayload>,
): Promise<EventResult> {
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
    const outcome = await deps.gameState.teamConnected(
      joinCode,
      team.id,
      client.id,
      () =>
        deps.teamService.listForSession(
          deps.gameState.getGameSessionId(joinCode),
        ),
    );

    const savedAnswers = await deps.answerService.listForTeam(
      deps.gameState.getGameSessionId(joinCode),
      team.id,
    );
    const savedBonusAwards = await deps.bonusService.listForTeam(
      deps.gameState.getGameSessionId(joinCode),
      team.id,
    );
    const savedRoundRatings =
      await deps.feedbackService.listRoundRatingsForTeam(
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
      roundRatings: savedRoundRatings,
    });

    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join';
    throw new WsException(message);
  }
}
