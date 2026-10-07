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
  points: number;
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
