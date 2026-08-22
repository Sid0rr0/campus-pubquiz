import type { BonusCategory } from '@campus-pubquiz/types';

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
