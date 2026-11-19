import type { SessionState } from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { JokerChanges } from '@/game/state/joker-changes';
import type { PurchaseChanges } from '@/game/state/purchase-changes';
import type { BlockGradingService } from '@/game/state/block-grading.service';
import {
  BROADCAST_STATE_OUTCOME,
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
  jokers: Pick<JokerChanges, 'followRoundsAfterEdit'>,
  purchases: Pick<PurchaseChanges, 'followRoundsAfterEdit'>,
  regradeQuestionIds: readonly number[],
): (started: SessionState) => Promise<SessionChange<SessionOutcome>> {
  return async (started) => {
    // Extra jokers, then jokers, follow their rounds (a joker is redrawn for a
    // deleted one, an extra joker refunded) before anything is graded, so the
    // regrade and every total see the final doubled rounds. The extra jokers go
    // first: a joker never lands on a round its team doubles that way.
    const { session: reloadedQuiz, changedTeamIds: purchaseTeamIds } =
      await purchases.followRoundsAfterEdit(
        started,
        await withReloadedQuiz(seedService, started),
      );
    const { session: reloaded, changedTeamIds: jokerTeamIds } =
      await jokers.followRoundsAfterEdit(started, reloadedQuiz);
    // With nothing to regrade (or nothing re-scored) this comes back with the
    // session unchanged and no questions or teams, i.e. a plain broadcast.
    const { session, regradedQuestionIds, answeringTeamIds } =
      await grading.regradeForKeyFix(reloaded, started, regradeQuestionIds);

    // A joker that moved or was redrawn, and every team holding a joker: a round's number or title may have shifted under its doubled rounds.
    const changedTeamIds = [
      ...new Set([
        ...session.teams
          .filter((team) => answeringTeamIds.has(team.teamId))
          .map((team) => team.teamId),
        ...purchaseTeamIds,
        ...jokerTeamIds,
        ...Object.keys(session.jokers).map(Number),
      ]),
    ];
    return {
      session,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        answerListQuestionIds: regradedQuestionIds,
        changedTeamIds,
      },
      touchedScores: true,
    };
  };
}
