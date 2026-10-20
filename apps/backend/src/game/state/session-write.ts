import { Injectable } from '@nestjs/common';
import type { SessionState } from '@campus-pubquiz/types';
import { StandingsService } from '@/standings/standings.service';
import { SessionWriteQueue } from '@/game/state/session-write-queue';
import { LiveResultsRead } from '@/game/state/live-results-read';
import { withPriorStandings } from '@/game/state/session-updates.util';
import { deadlinesOf, type SessionOutcome } from '@/game/state/session-outcome';

/** What a change returns: the new session and the outcome the write resolves to. */
export interface SessionChange<T> {
  session: SessionState;
  outcome: T;
}

export interface SessionWriteOptions {
  /** False for an event that doesn't change scores: skips the standings read. */
  refreshStandings?: boolean;
}

/**
 * The write a hold's task gets: same change and options as the queued write,
 * but run without queueing (the hold already owns the queues). Throws for a
 * join code outside the hold and for any call after the hold is released.
 */
export interface HeldWriter {
  write<T>(
    joinCode: string,
    change: (session: SessionState) => Promise<SessionChange<T>>,
    options?: SessionWriteOptions,
  ): Promise<T>;
}

/** Standings are read unless the write opts out. */
function shouldRefreshStandings(options?: SessionWriteOptions): boolean {
  return options?.refreshStandings ?? true;
}

function isSessionOutcome(value: unknown): value is SessionOutcome {
  return typeof value === 'object' && value !== null && 'replies' in value;
}

function haveDeadlinesMoved(
  before: SessionState,
  after: SessionState,
): boolean {
  const { questionLockAt, kahootQuestionEndsAt } = deadlinesOf(before);
  return (
    questionLockAt !== after.questionLockAt ||
    kahootQuestionEndsAt !== after.kahootQuestionEndsAt
  );
}

/**
 * The Session write's deadline report: `outcome` with the new auto-lock
 * deadlines attached when `stored` moved either one from `started`. Results
 * that carry no deadlines (nothing to push, a join's team) pass through, but
 * a deadline that moved with nowhere to report it throws: dropping it would
 * leave a timer on a stale deadline live on stage.
 */
function reportDeadlineChange<T>(
  started: SessionState,
  stored: SessionState,
  outcome: T,
): T {
  if (!haveDeadlinesMoved(started, stored)) return outcome;
  if (!isSessionOutcome(outcome)) {
    throw new Error(
      'A session write moved an auto-lock deadline but returned no SessionOutcome to carry it',
    );
  }
  return { ...outcome, deadlineChange: deadlinesOf(stored) };
}

/**
 * The Session write module: the only holder of the in-memory sessions (keyed
 * by joinCode, one backend instance — see CLAUDE.md) and the only way a
 * session is stored. Owns the per-session queue, the final live results read,
 * and the auto-lock deadline report. Composed inside
 * a Nest provider, injected into the game state class.
 */
@Injectable()
export class SessionWrite {
  private readonly sessions = new Map<string, SessionState>();
  private readonly queue = new SessionWriteQueue();
  /** Whether onModuleInit has resolved — lets read() distinguish "used too early" from "unknown joinCode". */
  private initialized = false;

  private readonly liveResultsRead: LiveResultsRead;

  constructor(standingsService: StandingsService) {
    this.liveResultsRead = new LiveResultsRead(standingsService);
  }

  markInitialized(): void {
    this.initialized = true;
  }

  has(joinCode: string): boolean {
    return this.sessions.has(joinCode);
  }

  list(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /** The session as the latest write left it. Synchronous. */
  read(joinCode: string): SessionState {
    // Distinguishing "never initialized" from "unknown joinCode" gives
    // onModuleInit-ordering bugs a clearer error than a generic lookup miss.
    if (!this.initialized) {
      throw new Error(
        'GameStateService used before initialization (onModuleInit has not resolved yet)',
      );
    }
    const session = this.sessions.get(joinCode);
    if (!session) {
      throw new Error(`Unknown game session for join code "${joinCode}"`);
    }
    return session;
  }

  /** Resolves once every write queued for `joinCode` has finished. Only observes the queue. */
  idle(joinCode: string): Promise<void> {
    return this.queue.idle(joinCode);
  }

  /**
   * Stores an already-settled session. For session creation and restart
   * restore only, which reach their starting point through the Move committer.
   */
  place(joinCode: string, session: SessionState): void {
    this.sessions.set(joinCode, session);
  }

  /**
   * A session write: runs `change` against the session as the previous write
   * for this join code left it, refreshes the live results once as the
   * last step (unless the write says it doesn't change scores), stores the
   * result and returns the change's outcome. A change that throws stores
   * nothing and doesn't hold up the next write; a failed live result read,
   * after the change has done its work, is logged and the session is stored
   * with that figure's earlier value. Not re-entrant: `change` must not call another public event
   * method of the owning game state class.
   */
  write<T>(
    joinCode: string,
    change: (session: SessionState) => Promise<SessionChange<T>>,
    options?: SessionWriteOptions,
  ): Promise<T> {
    const refreshStandings = shouldRefreshStandings(options);
    return this.queue.run(joinCode, () =>
      this.writeNow(joinCode, change, refreshStandings),
    );
  }

  /**
   * Deletes the session on its queue, so a write still in progress can't put
   * it back and one queued behind it finds no session. `check` runs against
   * the session as the previous write left it and may throw to refuse.
   */
  remove(
    joinCode: string,
    check: (session: SessionState) => void,
  ): Promise<void> {
    return this.queue.run(joinCode, () => {
      check(this.read(joinCode));
      this.sessions.delete(joinCode);
      return Promise.resolve();
    });
  }

  /**
   * Holds the queues of every join code in `joinCodes` while `task` runs, and
   * gives the task a held writer for them. The writer is valid only while the
   * hold lasts: it refuses a join code outside the hold and every write once
   * the hold is released, so a session is never written outside its queue
   * after the hold ends.
   */
  hold<T>(
    joinCodes: readonly string[],
    task: (held: HeldWriter) => Promise<T>,
  ): Promise<T> {
    const heldCodes = new Set(joinCodes);
    let isReleased = false;
    const held: HeldWriter = {
      write: async (joinCode, change, options) => {
        if (isReleased) {
          throw new Error(
            `Held writer used after its hold was released (join code "${joinCode}")`,
          );
        }
        if (!heldCodes.has(joinCode)) {
          throw new Error(
            `Held writer refused: join code "${joinCode}" is not part of the hold`,
          );
        }
        return this.writeNow(joinCode, change, shouldRefreshStandings(options));
      },
    };
    return this.queue.hold(joinCodes, async () => {
      try {
        return await task(held);
      } finally {
        isReleased = true;
      }
    });
  }

  private async writeNow<T>(
    joinCode: string,
    change: (session: SessionState) => Promise<SessionChange<T>>,
    refreshStandings: boolean,
  ): Promise<T> {
    const started = this.read(joinCode);
    return this.commit(
      joinCode,
      started,
      await change(started),
      refreshStandings,
    );
  }

  /**
   * The one place a write is stored and its deadline change reported.
   * Compares the session as stored (with its fresh leaderboard) to the one it
   * started from.
   */
  private async commit<T>(
    joinCode: string,
    started: SessionState,
    { session: changedSession, outcome }: SessionChange<T>,
    refreshStandings: boolean,
  ): Promise<T> {
    // The change has already done its database work (a press has saved its
    // progress), so it counts as done even if a live result read fails: the
    // live results read keeps that figure's earlier value.
    const sessionToStore = withPriorStandings(started, changedSession);
    this.sessions.set(
      joinCode,
      refreshStandings
        ? await this.liveResultsRead.read(sessionToStore)
        : sessionToStore,
    );
    return reportDeadlineChange(started, this.read(joinCode), outcome);
  }
}
