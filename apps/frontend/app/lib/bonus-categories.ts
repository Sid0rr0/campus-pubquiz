import type {
  BonusCategory,
  QuizStructureSummary,
} from '@campus-pubquiz/types';

/** Display label per bonus category — shared by the admin award form, session settings, and the /play bonus drawer. */
export const BONUS_CATEGORY_LABELS: Record<BonusCategory, string> = {
  shot: 'Shot',
  selfie: 'Selfie',
  custom: 'Custom',
};

/**
 * Player-facing explanation of what earns each predefined bonus category,
 * shown on /play's bonus drawer. "custom" has no fixed explanation here —
 * its reason is written per-award by the admin and shown alongside the
 * award itself instead.
 */
export const BONUS_CATEGORY_EXPLANATIONS: Partial<
  Record<BonusCategory, string>
> = {
  shot: 'Order shots, at minimum more than half your player count. (1 point, doable twice per quiz)',
  selfie:
    'Snap a group photo or selfie with your whole team, post it as an Instagram story, and tag @esn.cut and @isc_hub.cz. (1 point)',
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
