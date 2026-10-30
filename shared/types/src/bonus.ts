/** "shot"/"selfie" are the predefined quick-award categories; "custom" requires a `reason`. */
export type BonusCategory = 'shot' | 'selfie' | 'custom';

export const BONUS_CATEGORIES: readonly BonusCategory[] = [
  'shot',
  'selfie',
  'custom',
];

export interface AwardBonusPayload {
  teamId: number;
  category: BonusCategory;
  /** Free-text reason, required for category "custom", ignored otherwise. */
  reason?: string;
  /** 0 gives coins alone (no bonus award is stored). Otherwise a non-zero half-point number. */
  points: number;
  /** A manual coin award (any non-zero integer, negative takes coins), stored apart from the points. Refused when the session has no power-ups. */
  coins?: number;
}

/** Pushed privately to a team's own socket when coins are awarded to it: what it got and its new balance. */
export interface CoinAwardedPayload {
  /** The coins this award gave (negative when taken). */
  coins: number;
  reason?: string;
  /** The team's coin balance after the award. */
  balance: number;
}

/** Pushed privately to a team's own socket when its coins changed without a new award (a linked coin award went with its deleted bonus award). */
export interface TeamCoinsSyncedPayload {
  balance: number;
}

/** One bonus award a team has actually received — the team-facing view used by both JoinAcceptedPayload.bonusAwards and BONUS_AWARDED. */
export interface TeamBonusAwardView {
  category: BonusCategory;
  points: number;
  /** Present only for category "custom". */
  reason?: string;
}

/** Admin-only view of one bonus award — adds the id/timestamp a team-facing TeamBonusAwardView doesn't need. */
export interface BonusAwardAdminView extends TeamBonusAwardView {
  id: number;
  createdAt: string;
}

/** Response for GET /sessions/:joinCode/teams/:teamId/bonus-awards. */
export interface BonusAwardsListedPayload {
  teamId: number;
  awards: BonusAwardAdminView[];
}

/** Request body for PATCH /sessions/:joinCode/bonus-awards/:awardId. Category is intentionally not editable — changing it could invalidate the reason requirement for "custom". */
export interface UpdateBonusAwardRequest {
  points: number;
  reason?: string;
}

/** Pushed privately to a team's own connected socket the moment the admin awards it a bonus — mirrors ANSWER_RECEIVED's single-item, append-don't-replace shape. */
export type BonusAwardedPayload = TeamBonusAwardView;

/** Pushed privately to a team's own connected socket when the admin edits or deletes one of its awards — the team's full list, in award order, which replaces the phone's list (no toast). */
export interface TeamBonusAwardsSyncedPayload {
  bonusAwards: TeamBonusAwardView[];
}
