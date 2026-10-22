import type { Logger } from '@nestjs/common';
import { CreateRequestContext, type MikroORM } from '@mikro-orm/core';
import {
  QuestionLockTimerRegistry,
  type TimerScheduler,
} from '@/game/socket/question-lock-timer.registry';
import type { GameStateService } from '@/game/state/game-state.service';
import type {
  DeadlineChange,
  SessionOutcome,
} from '@/game/state/session-outcome';

/** Injection token for swapping the phase timers' schedulers; nothing provides it in production, so all three timers use real timers. */
export const PHASE_TIMER_SCHEDULERS = Symbol('PHASE_TIMER_SCHEDULERS');

export interface PhaseTimerSchedulers {
  lock: TimerScheduler;
  kahoot: TimerScheduler;
  jokerPick: TimerScheduler;
}

/** Hands an expiry's outcome to the outcome delivery step, which re-arms through `arm`. */
export type DeliverOutcome = (
  joinCode: string,
  outcome: SessionOutcome,
) => Promise<void>;

export interface PhaseTimersDeps {
  schedulers?: PhaseTimerSchedulers;
  gameState: GameStateService;
  orm: MikroORM;
  deliver: DeliverOutcome;
  logger: Logger;
}

/**
 * Owns the three phase timers for every live session: the question lock (the
 * last question of a breakAfter round has been open for the session's
 * settings.lockGraceSeconds), the kahoot question deadline (a kahootMode
 * question has been open for settings.kahootQuestionTimerSeconds) and the
 * joker pick deadline (the pick has been open for its fixed minute). An expiry
 * auto-advances exactly as if the admin had clicked "Advance" themselves.
 *
 * A plain class the gateway builds, not a Nest provider.
 */
export class PhaseTimers {
  // Read by @CreateRequestContext() to fork the expiry's request context.
  private readonly orm: MikroORM;
  private readonly gameState: GameStateService;
  private readonly deliver: DeliverOutcome;
  private readonly logger: Logger;
  private readonly lockTimers: QuestionLockTimerRegistry;
  private readonly kahootQuestionTimers: QuestionLockTimerRegistry;
  private readonly jokerPickTimers: QuestionLockTimerRegistry;

  constructor(deps: PhaseTimersDeps) {
    this.orm = deps.orm;
    this.gameState = deps.gameState;
    this.deliver = deps.deliver;
    this.logger = deps.logger;
    this.lockTimers = new QuestionLockTimerRegistry(deps.schedulers?.lock);
    this.kahootQuestionTimers = new QuestionLockTimerRegistry(
      deps.schedulers?.kahoot,
    );
    this.jokerPickTimers = new QuestionLockTimerRegistry(
      deps.schedulers?.jokerPick,
    );
  }

  /** (Re)arms this session's three timers to `deadlines`, clearing any stale ones first; a null deadline clears that timer. */
  arm(joinCode: string, deadlines: DeadlineChange): void {
    this.lockTimers.rearm(joinCode, deadlines.questionLockAt, () =>
      this.handleQuestionLockExpired(joinCode),
    );
    this.kahootQuestionTimers.rearm(
      joinCode,
      deadlines.kahootQuestionEndsAt,
      () => this.handleKahootQuestionExpired(joinCode),
    );
    this.jokerPickTimers.rearm(joinCode, deadlines.jokerPickEndsAt, () =>
      this.handleJokerPickExpired(joinCode),
    );
  }

  /** Arms every stored session to its current deadlines. */
  restoreAll(): void {
    for (const { joinCode } of this.gameState.listSessions()) {
      this.arm(joinCode, this.gameState.getDeadlines(joinCode));
    }
  }

  clearAll(): void {
    this.lockTimers.clearAll();
    this.kahootQuestionTimers.clearAll();
    this.jokerPickTimers.clearAll();
  }

  @CreateRequestContext()
  private async handleQuestionLockExpired(joinCode: string): Promise<void> {
    await this.advanceFromTimer(joinCode, 'Auto-lock');
  }

  @CreateRequestContext()
  private async handleKahootQuestionExpired(joinCode: string): Promise<void> {
    await this.advanceFromTimer(joinCode, 'Kahoot auto-lock');
  }

  @CreateRequestContext()
  private async handleJokerPickExpired(joinCode: string): Promise<void> {
    await this.advanceFromTimer(joinCode, 'Joker pick close');
  }

  /**
   * All three timers share the admin's ADVANCE path: the Live session's press,
   * delivered like any event, whose outcome arms the next deadline. A failure
   * is logged (there's no client to tell) and leaves the timers as the failed
   * write left them.
   */
  private async advanceFromTimer(
    joinCode: string,
    label: string,
  ): Promise<void> {
    try {
      await this.deliver(
        joinCode,
        await this.gameState.applyAdminAction(joinCode, 'ADVANCE'),
      );
    } catch (error) {
      this.logger.error(
        `${label} ADVANCE failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
