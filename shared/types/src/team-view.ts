import type { TeamAnswerView } from './answers';
import type { TeamBonusAwardView } from './bonus';
import type { RoundRatingView, TeamFeedbackView } from './feedback';
import type { TeamJoker } from './joker';
import type { PurchaseView } from './power-ups';
import type { TeamSessionRatingsView } from './session-scales';

/** A round that counts double for a team, by id, number and title ("" when the team bought it blind). */
export interface DoubledRoundView {
  roundId: number;
  roundNumber: number;
  title: string;
}

/**
 * Everything one team's own phones may know about the team, worked out on the
 * server. Sent with the join reply and again whenever a write changes the team;
 * the phone replaces its team data wholesale with each one. Never another team's.
 */
export interface OwnTeamView {
  /** The team's saved answers, redacted exactly as the players' room view. */
  answers: TeamAnswerView[];
  bonusAwards: TeamBonusAwardView[];
  roundRatings: RoundRatingView[];
  feedback: TeamFeedbackView;
  sessionRatings: TeamSessionRatingsView;
  /** Null until reported. */
  playerCount: number | null;
  joker: TeamJoker | null;
  sideId: string | null;
  coins: number;
  hasCarriedCoin: boolean;
  purchases: PurchaseView[];
  /** The open questions on which Ask the room is ready for the team. A flag per question, never a count. */
  roomReadyQuestionIds: number[];
  /** Every round that counts double for the team (joker round and extra jokers), in quiz order. */
  doubledRounds: DoubledRoundView[];
}
