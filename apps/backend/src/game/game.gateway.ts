import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { GameServer, GameSocket } from '@/game/socket/game-socket.types';
import type { z } from 'zod';
import type { AckResult } from '@campus-pubquiz/types';
import { SessionService } from '@/auth/session.service';
import { GameStateService } from '@/game/state/game-state.service';
import { corsOriginValidator } from '@/config/cors.config';
import {
  acceptConnection,
  disconnectClient,
} from '@/game/socket/connection.util';
import {
  dispatchSocketEvent,
  type EventContext,
  type EventResult,
} from '@/game/socket/guarded-dispatch.util';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import {
  SOCKET_EVENT_DECLARATIONS,
  type SocketEventDeclaration,
} from '@/game/socket/socket-event-declarations';

@WebSocketGateway({
  cors: { origin: corsOriginValidator, credentials: true },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: GameServer;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameState: GameStateService,
    private readonly sessions: SessionService,
    private readonly broadcaster: SessionBroadcaster,
  ) {}

  /** Nest calls this once the Socket.IO server exists; the broadcaster needs it to emit. */
  afterInit(server: GameServer): void {
    this.broadcaster.attach(server);
  }

  handleConnection(client: GameSocket): Promise<void> {
    return this.broadcaster.runInRequestContext(() =>
      acceptConnection(
        {
          gameState: this.gameState,
          sessions: this.sessions,
          logger: this.logger,
        },
        client,
      ),
    );
  }

  async handleDisconnect(client: GameSocket): Promise<void> {
    await disconnectClient(
      {
        gameState: this.gameState,
        logger: this.logger,
        deliver: this.broadcaster.deliver,
      },
      client,
    );
  }

  // Every handler goes through dispatch(), which forks the request context
  // Socket.IO events don't get from @mikro-orm/nestjs's HTTP-only middleware.
  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.adminAction.event)
  async handleAdminAction(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.adminAction,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.applyAdminAction(joinCode, payload.action),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.joinPlayers.event)
  async handleJoinPlayers(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.joinPlayers,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.teamJoined(
          joinCode,
          payload,
          client.id,
          (socketId) =>
            this.server.sockets.sockets.get(socketId)?.connected ?? false,
        ),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.submitAnswer.event)
  async handleSubmitAnswer(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.submitAnswer,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.submitAnswer(joinCode, payload, client.id),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.rateRound.event)
  async handleRateRound(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.rateRound,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.roundRated(joinCode, payload, client.id),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.sendFeedback.event)
  async handleSendFeedback(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.sendFeedback,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.feedbackSent(joinCode, payload, client.id),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setPlayerCount.event)
  async handleSetPlayerCount(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setPlayerCount,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.playerCountSet(joinCode, payload, client.id),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setTeamPlayerCount.event)
  async handleSetTeamPlayerCount(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setTeamPlayerCount,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.teamPlayerCountSet(joinCode, payload),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.gradeAnswer.event)
  async handleGradeAnswer(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.gradeAnswer,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.gradeAnswer(
          joinCode,
          payload.answerId,
          payload.pointsAwarded,
        ),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.kickTeam.event)
  async handleKickTeam(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.kickTeam,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.kickTeam(joinCode, payload.teamId),
    );
  }

  /**
   * A team's own explicit "log out" — unlike a transport disconnect (which
   * only marks the team as not-currently-connected, so a phone that sleeps or
   * loses signal can reconnect and resume), this removes the roster row
   * outright. Without it, a team that logs out and rejoins under a new name
   * (the only way to "rename" a team today) leaves its old identity behind as
   * a stale entry in /control that the admin has to kick by hand.
   */
  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.leaveSession.event)
  async handleLeaveSession(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.leaveSession,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.teamLeft(joinCode, payload.teamId, client.id),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setBreakEndTime.event)
  async handleSetBreakEndTime(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setBreakEndTime,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.breakEndTimeSet(joinCode, payload.breakEndsAt),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setDisplayTextScale.event)
  async handleSetDisplayTextScale(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setDisplayTextScale,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.displayTextScaleSet(joinCode, payload.displayTextScale),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setDisplaySoundMuted.event)
  async handleSetDisplaySoundMuted(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setDisplaySoundMuted,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.displaySoundMutedSet(
          joinCode,
          payload.isDisplaySoundMuted,
        ),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.awardBonus.event)
  async handleAwardBonus(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.awardBonus,
      rawPayload,
      client,
      ({ joinCode, payload }) => this.gameState.awardBonus(joinCode, payload),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.createShowdownRound.event)
  async handleCreateShowdownRound(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.createShowdownRound,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        this.gameState.createShowdownRound(joinCode, payload),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.submitShowdownGuess.event)
  async handleSubmitShowdownGuess(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.submitShowdownGuess,
      rawPayload,
      client,
      ({ joinCode, payload, client }) =>
        this.gameState.submitShowdownGuess(joinCode, payload, client.id),
    );
  }

  private dispatch<S extends z.ZodType>(
    declaration: SocketEventDeclaration<S>,
    rawPayload: unknown,
    client: GameSocket,
    body: (context: EventContext<z.infer<S>>) => Promise<EventResult>,
  ): Promise<AckResult> {
    return this.broadcaster.runInRequestContext(() =>
      dispatchSocketEvent(
        { deliver: this.broadcaster.deliver, logger: this.logger },
        client,
        declaration,
        rawPayload,
        body,
      ),
    );
  }
}
