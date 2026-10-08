import { Logger } from '@nestjs/common';
import type { LeaderboardEntry, SessionState } from '@campus-pubquiz/types';
import { StandingsService } from '@/standings/standings.service';
import { SessionWriteQueue } from '@/game/state/session-write-queue';
import { withLeaderboard } from '@/game/state/session-updates.util';
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
 * session is stored. Owns the per-session queue, the standings read and its
 * failed-read fallback, and the auto-lock deadline report. Composed inside
 * GameStateService rather than injected via Nest DI.
 */
export class SessionWrite {
  // A string, not `SessionWrite.name`: `nest build` crashes on a
  // self-reference in GameStateService, so both avoid it.
  private readonly logger = new Logger('SessionWrite');
  private readonly sessions = new Map<string, SessionState>();
  private readonly queue = new SessionWriteQueue();
  /** Whether onModuleInit has resolved — lets read() distinguish "used too early" from "unknown joinCode". */
  private initialized = false;

  constructor(private readonly standingsService: StandingsService) {}

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
   * for this join code left it, reads standings once as the last step
   * (unless the write says it doesn't change scores), stores the result and
   * returns the change's outcome. A change that throws stores nothing and
   * doesn't hold up the next write; a failed standings read, after the change
   * has done its work, is logged and the session is stored with its earlier
   * leaderboard. Not re-entrant: `change` must not call another public event
   * method of GameStateService.
   */
  write<T>(
    joinCode: string,
    change: (session: SessionState) => Promise<SessionChange<T>>,
    { refreshStandings = true }: SessionWriteOptions = {},
  ): Promise<T> {
    return this.queue.run(joinCode, async () => {
      const started = this.read(joinCode);
      return this.commit(
        joinCode,
        started,
        await change(started),
        refreshStandings,
      );
    });
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
   * TRANSITIONAL (ticket 02 replaces both this and `commitUnqueued` with a
   * held writer): holds the queues of every join code in `joinCodes` while
   * `task` runs.
   */
  hold<T>(joinCodes: readonly string[], task: () => Promise<T>): Promise<T> {
    return this.queue.hold(joinCodes, task);
  }

  /**
   * TRANSITIONAL (ticket 02): the commit step without the queue, for the held
   * quiz edit. Only valid while the caller holds `joinCode`'s queue.
   */
  commitUnqueuedWhileHeld<T>(
    joinCode: string,
    started: SessionState,
    change: SessionChange<T>,
  ): Promise<T> {
    return this.commit(joinCode, started, change, true);
  }

  /**
   * The one place a write is stored and its deadline change reported.
   * Compares the session as stored (with its fresh leaderboard) to the one it
   * started from.
   */
  private async commit<T>(
    joinCode: string,
    started: SessionState,
    { session, outcome }: SessionChange<T>,
    refreshStandings: boolean,
  ): Promise<T> {
    if (refreshStandings) await this.storeWithStandings(joinCode, session);
    else this.sessions.set(joinCode, session);
    return reportDeadlineChange(started, this.read(joinCode), outcome);
  }

  /**
   * Stores `session` after reading its standings. The change has already
   * done its database work (a press has saved its progress), so it counts as
   * done even if the standings read fails: memory must match what was saved
   * and clients must hear about it. The session keeps its earlier leaderboard
   * and the next write reads standings again.
   */
  private async storeWithStandings(
    joinCode: string,
    session: SessionState,
  ): Promise<void> {
    let leaderboard: LeaderboardEntry[] | undefined;
    try {
      leaderboard = await this.standingsService.leaderboard(
        session.seededGame.gameSessionId,
      );
    } catch (error) {
      this.logger.error(
        `Standings read failed for session ${joinCode}; keeping the earlier leaderboard until the next write`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    this.sessions.set(
      joinCode,
      leaderboard ? withLeaderboard(session, leaderboard) : session,
    );
  }
}
