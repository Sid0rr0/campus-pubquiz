import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { SessionService } from '@/auth/session.service';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { GameStateService } from '@/game/state/game-state.service';
import { corsOriginValidator } from '@/config/cors.config';
import { applyAdminAction } from '@/game/socket/handlers/admin-action.handler';
import { awardTeamBonus } from '@/game/socket/handlers/award-bonus.handler';
import {
  acceptConnection,
  disconnectClient,
} from '@/game/socket/connection.util';
import { createShowdownRound } from '@/game/socket/handlers/create-showdown-round.handler';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import { gradeTeamAnswer } from '@/game/socket/handlers/grade-answer.handler';
import { joinPlayerTeam } from '@/game/socket/handlers/join-players.handler';
import { kickTeamFromSession } from '@/game/socket/handlers/kick-team.handler';
import { QuestionLockTimerRegistry } from '@/game/socket/question-lock-timer.registry';
import { syncTeamAnswersOnRevealEntry } from '@/game/socket/reveal-entry-sync.util';
import { updateBreakEndTime } from '@/game/socket/handlers/set-break-end-time.handler';
import { submitShowdownGuess } from '@/game/socket/handlers/submit-showdown-guess.handler';
import {
  adminActionPayloadSchema,
  awardBonusPayloadSchema,
  createShowdownRoundPayloadSchema,
  gradeAnswerPayloadSchema,
  joinPlayersPayloadSchema,
  kickTeamPayloadSchema,
  parseSocketPayload,
  setBreakEndTimePayloadSchema,
  submitAnswerPayloadSchema,
  submitShowdownGuessPayloadSchema,
} from '@/game/socket/socket-payload.schemas';
import { submitTeamAnswer } from '@/game/socket/handlers/submit-answer.handler';
import { ShowdownService } from '@/showdown/showdown.service';

@WebSocketGateway({
  cors: { origin: corsOriginValidator, credentials: true },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);
  private readonly lockTimers = new QuestionLockTimerRegistry();

  constructor(
    private readonly gameState: GameStateService,
    private readonly teamService: TeamService,
    private readonly answerService: AnswerService,
    private readonly bonusService: BonusService,
    private readonly sessions: SessionService,
    private readonly orm: MikroORM,
    private readonly showdownService: ShowdownService,
  ) {}

  onModuleDestroy(): void {
    this.lockTimers.clearAll();
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

  handleDisconnect(client: Socket): void {
    disconnectClient(
      { gameState: this.gameState, server: this.server, logger: this.logger },
      client,
    );
  }

  /** Every non-connection handler reads the joinCode fixed on this socket at connect time. */
  private resolveJoinCode(client: Socket): string {
    const joinCode = (client.data as { joinCode?: string }).joinCode;
    if (!joinCode) {
      throw new WsException('Connection not associated with a game session');
    }
    return joinCode;
  }

  // Socket.IO events aren't covered by @mikro-orm/nestjs's HTTP-only
  // auto request-context middleware — @CreateRequestContext() forks one.
  @SubscribeMessage(SOCKET_EVENTS.ADMIN_ACTION)
  @CreateRequestContext()
  async handleAdminAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(adminActionPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may perform game actions');
    }

    this.logger.log(
      `${SOCKET_EVENTS.ADMIN_ACTION} from ${client.id}: action=${payload.action}`,
    );

    await applyAdminAction(
      {
        gameState: this.gameState,
        answerService: this.answerService,
        server: this.server,
      },
      joinCode,
      payload.action,
    );
    this.rearmQuestionLockTimer(joinCode);
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
    const previousStatus = this.gameState.getSnapshot(joinCode).progress.status;
    let snapshot: StateSnapshotPayload;
    try {
      snapshot = await this.gameState.applyAction(joinCode, 'ADVANCE');
    } catch (error) {
      this.logger.error(
        `Auto-lock ADVANCE failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    await syncTeamAnswersOnRevealEntry(
      {
        gameState: this.gameState,
        answerService: this.answerService,
        server: this.server,
      },
      joinCode,
      previousStatus,
      snapshot.progress.status,
    );

    broadcastGameState(this.server, joinCode, snapshot);
    this.rearmQuestionLockTimer(joinCode);
  }

  /** (Re)arms this session's auto-lock timer to match GameStateService's current deadline, clearing any stale one first. */
  private rearmQuestionLockTimer(joinCode: string): void {
    this.lockTimers.rearm(
      joinCode,
      this.gameState.getQuestionLockAt(joinCode),
      () => void this.handleQuestionLockTimerExpired(joinCode),
    );
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
   * notifySessionClosed's narrow one-off emit) so /display, /admin, and
   * /rules?code= all pick up the change immediately.
   */
  notifySettingsUpdated(joinCode: string): void {
    broadcastGameState(
      this.server,
      joinCode,
      this.gameState.getSnapshot(joinCode),
    );
  }

  /**
   * Called by BonusAwardMutationsController after editing/deleting a bonus
   * award via REST — recomputes the leaderboard and rebroadcasts, same as
   * awardTeamBonus's socket-handler tail, so /display and /admin never show
   * a stale bonus total after an out-of-band edit. No @CreateRequestContext()
   * needed: invoked synchronously from inside a REST controller method,
   * already covered by @mikro-orm/nestjs's HTTP-request-context middleware
   * (unlike socket handlers, which fork their own context — see
   * handleAdminAction above).
   */
  async notifyBonusAwardsChanged(joinCode: string): Promise<void> {
    const gameSessionId = this.gameState.getGameSessionId(joinCode);
    const leaderboard =
      await this.answerService.computeLeaderboard(gameSessionId);
    this.gameState.setLeaderboard(joinCode, leaderboard);
    broadcastGameState(
      this.server,
      joinCode,
      this.gameState.getSnapshot(joinCode),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_PLAYERS)
  @CreateRequestContext()
  async handleJoinPlayers(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(joinPlayersPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))) {
      throw new WsException('Only player clients may join a team');
    }

    this.logger.log(
      `${SOCKET_EVENTS.JOIN_PLAYERS} from ${client.id}: teamName=${payload.teamName}`,
    );

    await joinPlayerTeam(
      {
        gameState: this.gameState,
        teamService: this.teamService,
        answerService: this.answerService,
        bonusService: this.bonusService,
        server: this.server,
      },
      client,
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_ANSWER)
  @CreateRequestContext()
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(submitAnswerPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))) {
      throw new WsException('Only player clients may submit answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.SUBMIT_ANSWER} from ${client.id}: questionId=${payload.questionId} teamId=${payload.teamId}`,
    );

    await submitTeamAnswer(
      {
        gameState: this.gameState,
        answerService: this.answerService,
        server: this.server,
      },
      client,
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.GRADE_ANSWER)
  @CreateRequestContext()
  async handleGradeAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(gradeAnswerPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may grade answers');
    }

    this.logger.log(
      `${SOCKET_EVENTS.GRADE_ANSWER} from ${client.id}: answerId=${payload.answerId} pointsAwarded=${payload.pointsAwarded}`,
    );

    await gradeTeamAnswer(
      {
        gameState: this.gameState,
        answerService: this.answerService,
        server: this.server,
      },
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.KICK_TEAM)
  @CreateRequestContext()
  async handleKickTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(kickTeamPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may remove a team');
    }

    this.logger.log(
      `${SOCKET_EVENTS.KICK_TEAM} from ${client.id}: teamId=${payload.teamId}`,
    );

    await kickTeamFromSession(
      {
        gameState: this.gameState,
        teamService: this.teamService,
        server: this.server,
      },
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.SET_BREAK_END_TIME)
  @CreateRequestContext()
  // eslint-disable-next-line @typescript-eslint/require-await -- @CreateRequestContext() wraps this in a Promise at runtime regardless of the body, so the declared type must stay Promise<void> for callers (and tests) that await it
  async handleSetBreakEndTime(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(
      setBreakEndTimePayloadSchema,
      rawPayload,
    );
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may set the break end time');
    }

    this.logger.log(
      `${SOCKET_EVENTS.SET_BREAK_END_TIME} from ${client.id}: breakEndsAt=${payload.breakEndsAt}`,
    );

    updateBreakEndTime(
      { gameState: this.gameState, server: this.server },
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.AWARD_BONUS)
  @CreateRequestContext()
  async handleAwardBonus(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(awardBonusPayloadSchema, rawPayload);
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may award bonus points');
    }

    this.logger.log(
      `${SOCKET_EVENTS.AWARD_BONUS} from ${client.id}: teamId=${payload.teamId} category=${payload.category} points=${payload.points}`,
    );

    await awardTeamBonus(
      {
        gameState: this.gameState,
        bonusService: this.bonusService,
        answerService: this.answerService,
        server: this.server,
      },
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND)
  @CreateRequestContext()
  async handleCreateShowdownRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(
      createShowdownRoundPayloadSchema,
      rawPayload,
    );
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.ADMIN))) {
      throw new WsException('Only admin clients may start a showdown round');
    }

    this.logger.log(
      `${SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND} from ${client.id}: points=${payload.points}`,
    );

    await createShowdownRound(
      {
        gameState: this.gameState,
        showdownService: this.showdownService,
        server: this.server,
      },
      joinCode,
      payload,
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS)
  @CreateRequestContext()
  async handleSubmitShowdownGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<void> {
    const payload = parseSocketPayload(
      submitShowdownGuessPayloadSchema,
      rawPayload,
    );
    const joinCode = this.resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))) {
      throw new WsException('Only player clients may submit a showdown guess');
    }

    this.logger.log(
      `${SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS} from ${client.id}: showdownRoundId=${payload.showdownRoundId} teamId=${payload.teamId}`,
    );

    await submitShowdownGuess(
      {
        gameState: this.gameState,
        showdownService: this.showdownService,
        server: this.server,
      },
      client,
      joinCode,
      payload,
    );
  }
}
