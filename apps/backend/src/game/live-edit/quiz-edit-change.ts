import type { SessionState } from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { BlockGradingService } from '@/game/state/block-grading.service';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';

/**
 * Re-reads the quiz's rounds from the database, keeping the session, join
 * code and progress.
 */
async function withReloadedQuiz(
  seedService: SeedService,
  session: SessionState,
): Promise<SessionState> {
  const { quizId, gameSessionId, joinCode } = session.seededGame;
  const seededGame = await seedService.loadGame(
    quizId,
    gameSessionId,
    joinCode,
  );
  return { ...session, seededGame };
}

/**
 * The change of a quiz edit: reloads the session's questions and re-grades
 * `regradeQuestionIds` (already-shown questions whose answer/points were
 * corrected). Stores nothing and never queues: it is handed to a session
 * write, held or ordinary. A reload always ends in a broadcast; the outcome
 * also names every re-scored question for a fresh admin answer list, and
 * every connected team with an answer to one for a per-team sync.
 */
export function quizEditChange(
  seedService: SeedService,
  grading: BlockGradingService,
  regradeQuestionIds: readonly number[],
): (started: SessionState) => Promise<SessionChange<SessionOutcome>> {
  return async (started) => {
    const reloaded = await withReloadedQuiz(seedService, started);
    if (regradeQuestionIds.length === 0) {
      return { session: reloaded, outcome: BROADCAST_STATE_OUTCOME };
    }

    const { session, regradedQuestionIds, answeringTeamIds } =
      await grading.regradeForKeyFix(reloaded, started, regradeQuestionIds);
    if (regradedQuestionIds.length === 0) {
      return { session, outcome: BROADCAST_STATE_OUTCOME };
    }

    const teamSyncs = connectedTeamSyncs(
      session,
      session.teams
        .filter((team) => answeringTeamIds.has(team.teamId))
        .map((team) => team.teamId),
    );
    return {
      session,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        answerListQuestionIds: regradedQuestionIds,
        teamSyncs,
      },
    };
  };
}
