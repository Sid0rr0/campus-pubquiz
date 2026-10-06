import type {
  BonusCategory,
  QuizStructureSummary,
  TeamBonusAwardView,
} from '@campus-pubquiz/types';

/** Display label per bonus category — shared by the admin award form, session settings, and the /play bonus drawer. */
export const BONUS_CATEGORY_LABELS: Record<BonusCategory, string> = {
  shot: 'Shot',
  selfie: 'Selfie',
  custom: 'Custom',
};

const MINUS_SIGN = '−';

/** Bonus points with an explicit sign — "+1", "−1" (a real minus sign), "+0.5". Used wherever a bonus award is shown, so the drawer and the toasts never disagree. */
export function formatSignedPoints(points: number): string {
  return points < 0 ? `${MINUS_SIGN}${Math.abs(points)}` : `+${points}`;
}

/** The team-facing toast line for a freshly given award, e.g. "+1 point — Selfie" or "−1 point — Custom: phone use". "point" is singular only for exactly ±1. */
export function formatBonusAwardToast(award: TeamBonusAwardView): string {
  const unit = Math.abs(award.points) === 1 ? 'point' : 'points';
  const label = BONUS_CATEGORY_LABELS[award.category];
  const category = award.reason ? `${label}: ${award.reason}` : label;
  return `${formatSignedPoints(award.points)} ${unit} — ${category}`;
}

/** The quiz master's confirmation of an accepted award, e.g. "+1 Selfie → The Quizzly Bears". */
export function formatBonusAwardConfirmation(
  category: BonusCategory,
  points: number,
  teamName: string,
): string {
  return `${formatSignedPoints(points)} ${BONUS_CATEGORY_LABELS[category]} → ${teamName}`;
}

/**
 * Player-facing explanation of what earns each predefined bonus category,
 * shown on /play's bonus drawer. "custom" has no fixed explanation here —
 * its reason is written per-award by the admin and shown alongside the
 * award itself instead.
 */
export const BONUS_CATEGORY_EXPLANATIONS: Partial<
  Record<BonusCategory, string>
> = {
  shot: 'Order shots, at minimum more than half your player count. Must be checked by a moderator to get the points. (1 point, doable twice per quiz)',
  selfie:
    'Snap a group photo or selfie with your whole team, post it as an Instagram story, and tag @esn.ctu and @isc_hub.cz. Must be checked by a moderator to get the points. (1 point)',
};

/** Point value a predefined-category award starts at (editable per award) — also shown next to each category in SessionSettingsForm's award-count caps and the /play bonus drawer. */
export const DEFAULT_BONUS_POINTS = 1;

/**
 * Shown alongside the bonus list on both /play (BonusProgressList) and
 * /display (BreakBonusList) — bonuses close one break early (at the end of
 * the *second-to-last* break) so the admin has the final break free to wrap
 * up grading without new awards still coming in. Clamped to break 1 for a
 * single-break quiz, which has no earlier break to name instead.
 */
export function getBonusEarnDeadlineText(
  quizStructure: QuizStructureSummary,
): string {
  const deadlineBreakNumber = Math.max(1, quizStructure.blockCount - 1);
  return `Bonus points can be earned until the end of break ${deadlineBreakNumber}.`;
}
