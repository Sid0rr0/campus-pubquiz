import type { Verdict } from './answer-kind';
import { POWER_UP_IDS, type PowerUpId } from './power-ups';
import { answerCredit } from './question-correct-rate';

/** How one question power-up paid off: its uses, and its hits credited like the correct rate. */
export interface PowerUpHits {
  powerUp: PowerUpId;
  uses: number;
  /** Summed answer credit of the buying teams on the bought questions; hits ÷ uses is the Power-up hit rate. */
  hits: number;
}

/**
 * The Power-up hit rate's one rule, for the stats page and the fun facts: per
 * question power-up used at least once, in power-up order. A use whose team
 * never answered is a miss; a round power-up (the extra joker) has no hits.
 */
export function powerUpHits(
  purchases: readonly {
    teamId: number;
    powerUp: PowerUpId;
    questionId: number | null;
  }[],
  answers: readonly {
    questionId: number;
    teamId: number;
    verdict: Verdict | null;
    pointsAwarded: number;
  }[],
  pointsByQuestionId: ReadonlyMap<number, number>,
): PowerUpHits[] {
  const answerOf = new Map(
    answers.map((a) => [`${a.teamId}:${a.questionId}`, a]),
  );
  return POWER_UP_IDS.flatMap((powerUp) => {
    const uses = purchases.flatMap(({ teamId, questionId, ...p }) =>
      p.powerUp === powerUp && questionId !== null
        ? [{ teamId, questionId }]
        : [],
    );
    if (uses.length === 0) return [];
    const hits = uses.reduce((sum, { teamId, questionId }) => {
      const answer = answerOf.get(`${teamId}:${questionId}`);
      return answer
        ? sum + answerCredit(answer, pointsByQuestionId.get(questionId) ?? 0)
        : sum;
    }, 0);
    return [{ powerUp, uses: uses.length, hits }];
  });
}
