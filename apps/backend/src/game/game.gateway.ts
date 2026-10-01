import {
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import {
  type AckResult,
  type AuthUser,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import { SessionService } from '@/auth/session.service';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { GameStateService } from '@/game/state/game-state.service';
import { corsOriginValidator } from '@/config/cors.config';
import {
  acceptConnection,
  disconnectClient,
} from '@/game/socket/connection.util';
import {
  applyAdminAction,
  runAdminAction,
} from '@/game/socket/handlers/admin-action.handler';
import { awardTeamBonus } from '@/game/socket/handlers/award-bonus.handler';
import { createShowdownRound } from '@/game/socket/handlers/create-showdown-round.handler';
import type { EventServices } from '@/game/socket/handlers/event-services';
import { gradeTeamAnswer } from '@/game/socket/handlers/grade-answer.handler';
import { joinPlayerTeam } from '@/game/socket/handlers/join-players.handler';
import { kickTeamFromSession } from '@/game/socket/handlers/kick-team.handler';
import { leaveSessionAsTeam } from '@/game/socket/handlers/leave-session.handler';
import { submitShowdownGuess } from '@/game/socket/handlers/submit-showdown-guess.handler';
import { submitTeamAnswer } from '@/game/socket/handlers/submit-answer.handler';
import {
  dispatchSocketEvent,
  type EventContext,
  type EventResult,
} from '@/game/socket/guarded-dispatch.util';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import { QuestionLockTimerRegistry } from '@/game/socket/question-lock-timer.registry';
import {
  SOCKET_EVENT_DECLARATIONS,
  type SocketEventDeclaration,
} from '@/game/socket/socket-event-declarations';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import { ShowdownService } from '@/showdown/showdown.service';

@WebSocketGateway({
  cors: { origin: corsOriginValidator, credentials: true },
})
export class GameGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnApplicationBootstrap,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);
  private readonly lockTimers = new QuestionLockTimerRegistry();
  private readonly kahootQuestionTimers = new QuestionLockTimerRegistry();

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly bonusService: BonusService,
    private readonly sessions: SessionService,
    private readonly orm: MikroORM,
    private readonly showdownService: ShowdownService,
  ) {}

  /**
   * Runs once every module's onModuleInit has loaded the session store, so a
   * backend restart mid-countdown or mid-kahoot-question restores its
   * deadlines — otherwise nothing re-arms them until the next admin action.
   */
  onApplicationBootstrap(): void {
    for (const { joinCode } of this.gameState.listSessions()) {
      this.rearmTimers(joinCode);
    }
  }

  onModuleDestroy(): void {
    this.lockTimers.clearAll();
    this.kahootQuestionTimers.clearAll();
  }

  @CreateRequestContext()
  async handleConnection(client: Socket): Promise<void> {
    await acceptConnection(
      {
        gameState: this.gameState,
        sessions: this.sessions,
        logger: this.logger,
      },
      client,
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    await disconnectClient(
      { ...this.outcomeDeps, logger: this.logger },
      client,
    );
  }

  // Socket.IO events aren't covered by @mikro-orm/nestjs's HTTP-only
  // auto request-context middleware — @CreateRequestContext() forks one.
  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.adminAction.event)
  @CreateRequestContext()
  async handleAdminAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.adminAction,
      rawPayload,
      client,
      async ({ joinCode, payload }) => {
        // The deadlines must follow the state whether or not the action
        // applied cleanly, and even if delivering it fails.
        const rearm = () => this.rearmTimers(joinCode);
        let outcome: SessionOutcome;
        try {
          outcome = await applyAdminAction(
            this.gameState,
            joinCode,
            payload.action,
          );
        } catch (error) {
          rearm();
          throw error;
        }
        return { outcome, afterDelivery: rearm };
      },
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.joinPlayers.event)
  @CreateRequestContext()
  async handleJoinPlayers(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.joinPlayers,
      rawPayload,
      client,
      (context) => joinPlayerTeam(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.submitAnswer.event)
  @CreateRequestContext()
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.submitAnswer,
      rawPayload,
      client,
      (context) => submitTeamAnswer(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.gradeAnswer.event)
  @CreateRequestContext()
  async handleGradeAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.gradeAnswer,
      rawPayload,
      client,
      (context) => gradeTeamAnswer(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.kickTeam.event)
  @CreateRequestContext()
  async handleKickTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.kickTeam,
      rawPayload,
      client,
      (context) => kickTeamFromSession(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.leaveSession.event)
  @CreateRequestContext()
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.leaveSession,
      rawPayload,
      client,
      (context) => leaveSessionAsTeam(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setBreakEndTime.event)
  @CreateRequestContext()
  async handleSetBreakEndTime(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setBreakEndTime,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        Promise.resolve(
          this.gameState.breakEndTimeSet(joinCode, payload.breakEndsAt),
        ),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.setDisplayTextScale.event)
  @CreateRequestContext()
  async handleSetDisplayTextScale(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.setDisplayTextScale,
      rawPayload,
      client,
      ({ joinCode, payload }) =>
        Promise.resolve(
          this.gameState.displayTextScaleSet(
            joinCode,
            payload.displayTextScale,
          ),
        ),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.awardBonus.event)
  @CreateRequestContext()
  async handleAwardBonus(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.awardBonus,
      rawPayload,
      client,
      (context) => awardTeamBonus(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.createShowdownRound.event)
  @CreateRequestContext()
  async handleCreateShowdownRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.createShowdownRound,
      rawPayload,
      client,
      (context) => createShowdownRound(this.services, context),
    );
  }

  @SubscribeMessage(SOCKET_EVENT_DECLARATIONS.submitShowdownGuess.event)
  @CreateRequestContext()
  async handleSubmitShowdownGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<AckResult> {
    return this.dispatch(
      SOCKET_EVENT_DECLARATIONS.submitShowdownGuess,
      rawPayload,
      client,
      (context) => submitShowdownGuess(this.services, context),
    );
  }

  private get outcomeDeps() {
    return {
      gameState: this.gameState,
      answerService: this.answerService,
      server: this.server,
    };
  }

  /**
   * Fires when the last question of a breakAfter round has been open for
   * the session's settings.lockGraceSeconds with no admin action —
   * auto-advances exactly as if the admin had clicked "Advance" themselves.
   */
  @CreateRequestContext()
  private async handleQuestionLockTimerExpired(
    joinCode: string,
  ): Promise<void> {
    await this.advanceFromTimer(joinCode, 'Auto-lock');
  }

  /**
   * Fires when a kahootMode question has been open for the session's
   * settings.kahootQuestionTimerSeconds with no admin action — auto-locks it
   * exactly as if the admin had clicked "Advance" themselves.
   */
  @CreateRequestContext()
  private async handleKahootQuestionTimerExpired(
    joinCode: string,
  ): Promise<void> {
    await this.advanceFromTimer(joinCode, 'Kahoot auto-lock');
  }

  /** Both timers share the admin's ADVANCE path; a failure is logged (there's no client to tell) and leaves the timers as they were. */
  private async advanceFromTimer(
    joinCode: string,
    label: string,
  ): Promise<void> {
    try {
      await runAdminAction(this.outcomeDeps, joinCode, 'ADVANCE');
    } catch (error) {
      this.logger.error(
        `${label} ADVANCE failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    this.rearmTimers(joinCode);
  }

  /** (Re)arms both this session's auto-lock timers to match GameStateService's current deadlines, clearing any stale ones first. */
  private rearmTimers(joinCode: string): void {
    this.lockTimers.rearm(
      joinCode,
      this.gameState.getQuestionLockAt(joinCode),
      () => void this.handleQuestionLockTimerExpired(joinCode),
    );
    this.kahootQuestionTimers.rearm(
      joinCode,
      this.gameState.getKahootQuestionEndsAt(joinCode),
      () => void this.handleKahootQuestionTimerExpired(joinCode),
    );
  }

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
    await deliverOutcome(this.outcomeDeps, joinCode, BROADCAST_STATE_OUTCOME);
  }

  /**
   * Called by QuizController.update after persisting an in-place edit to a
   * quiz with a live session on it — reloads that session's in-memory
   * question snapshot from the DB, re-grades `regradeQuestionIds` (already-
   * shown questions whose answer/points were corrected) against it, and
   * rebroadcasts the full state, so /display, /control, and /play pick up
   * the correction without needing a reconnect. No @CreateRequestContext()
   * needed, same reasoning as notifyBonusAwardsChanged below.
   */
  async notifyQuizEdited(
    joinCode: string,
    regradeQuestionIds: readonly number[] = [],
  ): Promise<void> {
    await deliverOutcome(
      this.outcomeDeps,
      joinCode,
      await this.gameState.quizEdited(joinCode, regradeQuestionIds),
    );
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
    await deliverOutcome(
      this.outcomeDeps,
      joinCode,
      await this.gameState.bonusChanged(joinCode),
    );
  }

  private get services(): EventServices {
    return {
      gameState: this.gameState,
      teamService: this.teamService,
      answerService: this.answerService,
      bonusService: this.bonusService,
      showdownService: this.showdownService,
      server: this.server,
    };
  }

  private dispatch<S extends z.ZodType>(
    declaration: SocketEventDeclaration<S>,
    rawPayload: unknown,
    client: Socket,
    body: (context: EventContext<z.infer<S>>) => Promise<EventResult>,
  ): Promise<AckResult> {
    return dispatchSocketEvent(
      { ...this.outcomeDeps, logger: this.logger },
      client,
      declaration,
      rawPayload,
      body,
    );
  }
}
