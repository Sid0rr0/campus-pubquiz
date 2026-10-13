import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { AnswerService } from '@/answer/answer.service';
import { GameStateService } from '@/game/state/game-state.service';
import type { GameServer, GameSocket } from '@/game/socket/game-socket.types';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import {
  PHASE_TIMER_SCHEDULERS,
  PhaseTimers,
  type PhaseTimerSchedulers,
} from '@/game/socket/phase-timers';
import type { SessionOutcome } from '@/game/state/session-outcome';

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
    orm: MikroORM,
    @Optional()
    @Inject(PHASE_TIMER_SCHEDULERS)
    timerSchedulers?: PhaseTimerSchedulers,
  ) {
    this.phaseTimers = new PhaseTimers({
      schedulers: timerSchedulers,
      gameState,
      orm,
      deliver: (joinCode, outcome) => this.deliver(joinCode, outcome),
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

  /** Called by the gateway's init hook once the Socket.IO server exists. */
  attach(server: GameServer): void {
    this.server = server;
  }

  /** Delivers an outcome (see `deliverOutcome` for the order); `sender` is absent for outcomes no socket sent. */
  async deliver(
    joinCode: string,
    outcome: SessionOutcome,
    sender?: Pick<GameSocket, 'emit'>,
  ): Promise<void> {
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
