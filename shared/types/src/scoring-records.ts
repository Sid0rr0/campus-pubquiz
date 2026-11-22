import type { Verdict } from './answer-kind';
import type { BonusCategory } from './bonus';
import type { PowerUpId } from './power-ups';

/** One submitted answer, as the live views read it. */
export interface ScoringAnswer {
  questionId: number;
  teamId: number;
  teamName: string;
  /** Null while the answer is ungraded. */
  verdict: Verdict | null;
  pointsAwarded: number;
  /** Final submission time minus the question's open time; null when untracked. */
  responseMs: number | null;
  /** Clue question only: the clue (1-based) on air when the answer was locked in; null or absent otherwise. */
  clue?: number | null;
}

/** One bonus award, as the live views read it. */
export interface ScoringBonusAward {
  teamId: number;
  category: BonusCategory;
  points: number;
  /** First question id of the block in play when awarded; null for awards made before it was recorded. */
  blockFirstQuestionId: number | null;
}

/** One power-up purchase, as the live views read it: the reveal's power-up count and each team's coins. */
export interface ScoringPurchase {
  teamId: number;
  powerUp: PowerUpId;
  /** The question it was bought for; null for a round power-up. */
  questionId: number | null;
  /** The round an extra joker was bought for; null otherwise. */
  roundId: number | null;
  cost: number;
}

/**
 * The session's stored answers, bonus awards and power-up purchases. Read by
 * fun facts, doubled rounds, the board, rank callouts, the reveal's counts,
 * the Coin ledger, the live edit and stats. A cache filled with the standings,
 * so the display view stays synchronous.
 */
export interface ScoringRecords {
  answers: ScoringAnswer[];
  bonusAwards: ScoringBonusAward[];
  powerUps: ScoringPurchase[];
}
