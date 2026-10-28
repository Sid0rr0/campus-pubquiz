import type { SessionState } from '@campus-pubquiz/types';
import type { MoveCommitter } from '@/game/state/commit-a-move.service';
import {
  type DeadlineChange,
  NOTHING_TO_PUSH_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';

/**
 * The timer expiry change module: builds the change for a phase timer's
 * expiry standing in for an ADVANCE press. The expiry is checked against the
 * session the write holds, so one whose deadline a queued press already moved
 * or cleared pushes nothing instead of advancing the quiz a second step.
 */
export class TimerExpiryChanges {
  constructor(private readonly moveCommitter: MoveCommitter) {}

  advanceOnExpiry(
    session: SessionState,
    deadline: keyof DeadlineChange,
    dueAt: number,
  ): Promise<SessionChange<SessionOutcome>> {
    return session[deadline] === dueAt
      ? this.moveCommitter.commit(session, 'ADVANCE')
      : Promise.resolve({
          session,
          outcome: NOTHING_TO_PUSH_OUTCOME,
          touchedScores: false,
        });
  }
}
