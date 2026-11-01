import type { SessionState } from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { JokerChanges } from '@/game/state/joker-changes';
import type { PurchaseChanges } from '@/game/state/purchase-changes';
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
  jokers: Pick<JokerChanges, 'followRoundsAfterEdit'>,
  purchases: Pick<PurchaseChanges, 'followRoundsAfterEdit'>,
  regradeQuestionIds: readonly number[],
): (started: SessionState) => Promise<SessionChange<SessionOutcome>> {
  return async (started) => {
    // Extra jokers, then jokers, follow their rounds (a joker is redrawn for a
    // deleted one, an extra joker refunded) before anything is graded, so the
    // regrade and every total see the final doubled rounds. The extra jokers go
    // first: a joker never lands on a round its team doubles that way.
    const { session: reloadedQuiz, purchaseSyncs } =
      await purchases.followRoundsAfterEdit(
        started,
        await withReloadedQuiz(seedService, started),
      );
    const { session: reloaded, jokerSyncs } =
      await jokers.followRoundsAfterEdit(started, reloadedQuiz);
    const broadcast = {
      ...BROADCAST_STATE_OUTCOME,
      jokerSyncs,
      purchaseSyncs,
    };
    if (regradeQuestionIds.length === 0) {
      return {
        session: reloaded,
        outcome: broadcast,
        touchedScores: true,
      };
    }

    const { session, regradedQuestionIds, answeringTeamIds } =
      await grading.regradeForKeyFix(reloaded, started, regradeQuestionIds);
    if (regradedQuestionIds.length === 0) {
      return {
        session,
        outcome: broadcast,
        touchedScores: true,
      };
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
        ...broadcast,
        answerListQuestionIds: regradedQuestionIds,
        teamSyncs,
      },
      touchedScores: true,
    };
  };
}
