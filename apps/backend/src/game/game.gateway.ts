import { Logger } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
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
import {
  type AckResult,
  type AuthUser,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
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
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';

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
    // Read by @CreateRequestContext() to fork each socket event's context.
    private readonly orm: MikroORM,
  ) {}

  /** Nest calls this once the Socket.IO server exists; the broadcaster needs it to emit. */
  afterInit(server: GameServer): void {
    this.broadcaster.attach(server);
  }

  @CreateRequestContext()
  async handleConnection(client: GameSocket): Promise<void> {
    await acceptConnection(
      {
        gameState: this.gameState,
        sessions: this.sessions,
        logger: this.logger,
      },
      client,
    );
  }

  async handleDisconnect(client: GameSocket): Promise<void> {
    await disconnectClient(
      {
        gameState: this.gameState,
        logger: this.logger,
        deliver: this.deliver,
      },
      client,
    );
  }

  // Socket.IO events aren't covered by @mikro-orm/nestjs's HTTP-only
  // auto request-context middleware — @CreateRequestContext() forks one.
  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.adminAction.event)
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.gradeAnswer.event)
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.awardBonus.event)
  @CreateRequestContext()
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
  @CreateRequestContext()
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
  @CreateRequestContext()
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

  private readonly deliver = (
    joinCode: string,
    outcome: SessionOutcome,
    sender?: Pick<GameSocket, 'emit'>,
  ): Promise<void> => this.broadcaster.deliver(joinCode, outcome, sender);

  /**
   * Called by UsersController once it has deactivated a user — revoking their
   * session rows only stops future requests; an already-open /control socket
   * would otherwise keep its admin powers until it happened to disconnect.
   */
  disconnectUser(userId: number): void {
    for (const socket of this.server.sockets.sockets.values()) {
      const user = (socket.data as { user?: AuthUser }).user;
      if (user?.id === userId) socket.disconnect(true);
    }
  }

  /**
   * Called by SessionsController once it has evicted a session (`DELETE
   * /sessions/:joinCode`) — the in-memory session is already gone by this
   * point, so any player still connected to it would otherwise only find out
   * on its next action, as an opaque "Unknown game session" error. Scoped to
   * the players room alone: the closing admin already navigates away via its
   * own REST response, and /display has no redirect target of its own yet.
   */
  notifySessionClosed(joinCode: string): void {
    this.server
      .to(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))
      .emit(SOCKET_EVENTS.SESSION_CLOSED, { joinCode });
  }

  /**
   * Called by SessionsController once it has persisted new settings (`PATCH
   * /sessions/:joinCode/settings`) — a full state re-broadcast (unlike
   * notifySessionClosed's narrow one-off emit) so /display, /control, and
   * /rules?code= all pick up the change immediately.
   */
  async notifySettingsUpdated(joinCode: string): Promise<void> {
    await this.broadcaster.deliver(joinCode, BROADCAST_STATE_OUTCOME);
  }

  /** Delivers an outcome a session write returned outside the gateway (the Live edit module's save), after its queues were released. */
  async deliverSessionOutcome(
    joinCode: string,
    outcome: SessionOutcome,
  ): Promise<void> {
    await this.broadcaster.deliver(joinCode, outcome);
  }

  /**
   * Called by BonusAwardMutationsController after editing/deleting a bonus
   * award via REST, so /display and /control never show a stale bonus total
   * after an out-of-band edit. No @CreateRequestContext() needed: invoked
   * synchronously from inside a REST controller method, already covered by
   * @mikro-orm/nestjs's HTTP-request-context middleware (unlike socket
   * handlers, which fork their own context — see handleAdminAction above).
   */
  async notifyBonusAwardsChanged(joinCode: string): Promise<void> {
    await this.broadcaster.deliver(
      joinCode,
      await this.gameState.bonusChanged(joinCode),
    );
  }

  private dispatch<S extends z.ZodType>(
    declaration: SocketEventDeclaration<S>,
    rawPayload: unknown,
    client: GameSocket,
    body: (context: EventContext<z.infer<S>>) => Promise<EventResult>,
  ): Promise<AckResult> {
    return dispatchSocketEvent(
      { deliver: this.deliver, logger: this.logger },
      client,
      declaration,
      rawPayload,
      body,
    );
  }
}
