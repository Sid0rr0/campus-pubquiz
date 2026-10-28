import type { Logger } from '@nestjs/common';
import { CreateRequestContext, type MikroORM } from '@mikro-orm/core';
import {
  QuestionLockTimerRegistry,
  type TimerScheduler,
} from '@/game/socket/question-lock-timer.registry';
import type { GameStateService } from '@/game/state/game-state.service';
import {
  PHASE_DEADLINE_KEYS,
  PHASE_DEADLINES,
  type DeadlineChange,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/** Injection token for swapping the phase timers' schedulers; nothing provides it in production, so all three timers use real timers. */
export const PHASE_TIMER_SCHEDULERS = Symbol('PHASE_TIMER_SCHEDULERS');

export type PhaseTimerSchedulers = Partial<
  Record<keyof DeadlineChange, TimerScheduler>
>;

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
  private readonly timers: Record<
    keyof DeadlineChange,
    QuestionLockTimerRegistry
  >;

  constructor(deps: PhaseTimersDeps) {
    this.orm = deps.orm;
    this.gameState = deps.gameState;
    this.deliver = deps.deliver;
    this.logger = deps.logger;
    this.timers = Object.fromEntries(
      PHASE_DEADLINE_KEYS.map((key) => [
        key,
        new QuestionLockTimerRegistry(deps.schedulers?.[key]),
      ]),
    ) as Record<keyof DeadlineChange, QuestionLockTimerRegistry>;
  }

  /** (Re)arms this session's timers to `deadlines`, clearing any stale ones first; a null deadline clears that timer. */
  arm(joinCode: string, deadlines: DeadlineChange): void {
    for (const key of PHASE_DEADLINE_KEYS) {
      this.timers[key].rearm(joinCode, deadlines[key], (dueAt) =>
        this.handleExpired(joinCode, key, dueAt),
      );
    }
  }

  /** Arms every stored session to its current deadlines. */
  restoreAll(): void {
    for (const { joinCode } of this.gameState.listSessions()) {
      this.arm(joinCode, this.gameState.getDeadlines(joinCode));
    }
  }

  clearAll(): void {
    for (const key of PHASE_DEADLINE_KEYS) this.timers[key].clearAll();
  }

  /**
   * Every timer shares the admin's ADVANCE path: the Live session's press,
   * delivered like any event, whose outcome arms the next deadline. The press
   * is only made if the session still holds the deadline this timer was armed
   * to when its turn in the write queue comes, so a press made meanwhile is
   * never stepped past. A failure is logged (there's no client to tell) and
   * leaves the timers as the failed write left them.
   */
  @CreateRequestContext()
  private async handleExpired(
    joinCode: string,
    deadline: keyof DeadlineChange,
    dueAt: number,
  ): Promise<void> {
    const { label } = PHASE_DEADLINES[deadline];
    try {
      await this.deliver(
        joinCode,
        await this.gameState.advanceOnExpiry(joinCode, deadline, dueAt),
      );
    } catch (error) {
      this.logger.error(
        `${label} ADVANCE failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
