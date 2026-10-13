import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { AnswerService } from '@/answer/answer.service';
import { GameStateService } from '@/game/state/game-state.service';
import type { GameServer } from '@/game/socket/game-socket.types';
import {
  deliverOutcome,
  type DeliverFn,
} from '@/game/socket/outcome-delivery.util';
import {
  PHASE_TIMER_SCHEDULERS,
  PhaseTimers,
  type PhaseTimerSchedulers,
} from '@/game/socket/phase-timers';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';
import {
  type AuthUser,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';

/**
 * Owns everything the backend pushes to connected clients: the one delivery
 * step that turns a session outcome into emits, and the phase timers whose
 * expiries are delivered like any other outcome. The gateway hands it the
 * Socket.IO server once the server exists.
 */
@Injectable()
export class SessionBroadcaster
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private server: GameServer | undefined;
  private readonly logger = new Logger(SessionBroadcaster.name);
  private readonly phaseTimers: PhaseTimers;

  constructor(
    private readonly gameState: GameStateService,
    private readonly answerService: AnswerService,
    private readonly orm: MikroORM,
    @Optional()
    @Inject(PHASE_TIMER_SCHEDULERS)
    timerSchedulers?: PhaseTimerSchedulers,
  ) {
    this.phaseTimers = new PhaseTimers({
      schedulers: timerSchedulers,
      gameState,
      orm,
      deliver: this.deliver,
      logger: this.logger,
    });
  }

  /**
   * Runs once every module's onModuleInit has loaded the session store, so a
   * backend restart mid-countdown or mid-kahoot-question restores its
   * deadlines — otherwise nothing re-arms them until the next admin action.
   */
  onApplicationBootstrap(): void {
    this.phaseTimers.restoreAll();
  }

  onModuleDestroy(): void {
    this.phaseTimers.clearAll();
  }

  /**
   * Runs `work` in a fresh MikroORM request context. Socket.IO events aren't
   * covered by @mikro-orm/nestjs's HTTP-only middleware, so the inbound
   * gateway forks one per event through here (same fork `@CreateRequestContext()` makes).
   */
  runInRequestContext<T>(work: () => Promise<T>): Promise<T> {
    return RequestContext.create(this.orm.em, work);
  }

  /** Called by the gateway's init hook once the Socket.IO server exists. */
  attach(server: GameServer): void {
    this.server = server;
  }

  /** Delivers an outcome (see `deliverOutcome` for the order); `sender` is absent for outcomes no socket sent. */
  readonly deliver: DeliverFn = async (joinCode, outcome, sender) => {
    await deliverOutcome(
      {
        gameState: this.gameState,
        answerService: this.answerService,
        server: this.requireServer(),
        rearmTimers: (code, deadlines) => this.phaseTimers.arm(code, deadlines),
      },
      joinCode,
      outcome,
      sender,
    );
  };

  /** Rebroadcasts the session state to /display, /control and /rules (after a REST settings change). */
  async broadcastState(joinCode: string): Promise<void> {
    await this.deliver(joinCode, BROADCAST_STATE_OUTCOME);
  }

  /**
   * Tells the players room a session was closed, so a phone doesn't find out
   * later as an opaque "Unknown game session" error. Players room only: the
   * closing admin navigates away via its REST response, and /display has no
   * redirect target.
   */
  notifySessionClosed(joinCode: string): void {
    this.requireServer()
      .to(sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS))
      .emit(SOCKET_EVENTS.SESSION_CLOSED, { joinCode });
  }

  /**
   * Disconnects every open socket of a deactivated user — revoking their
   * session rows only stops future requests; an open /control socket would
   * keep its admin powers.
   */
  disconnectUser(userId: number): void {
    for (const socket of this.requireServer().sockets.sockets.values()) {
      const user = (socket.data as { user?: AuthUser }).user;
      if (user?.id === userId) socket.disconnect(true);
    }
  }

  private requireServer(): GameServer {
    if (!this.server) {
      throw new Error(
        'SessionBroadcaster used before attach(server): the gateway must hand it the Socket.IO server first',
      );
    }
    return this.server;
  }
}
