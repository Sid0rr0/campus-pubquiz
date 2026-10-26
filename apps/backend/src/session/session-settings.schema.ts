import { z } from 'zod';
import {
  BONUS_CATEGORIES,
  DEFAULT_SESSION_SETTINGS,
  hasJokersWithoutOverview,
  JOKERS_NEED_OVERVIEW_MESSAGE,
  type BonusCategory,
  type SessionSettings,
} from '@campus-pubquiz/types';

const RULE_MAX_LENGTH = 500;
const MAX_RULES = 50;

const maxBonusAwardsPerCategorySchema = z
  .object(
    Object.fromEntries(
      BONUS_CATEGORIES.map((category) => [
        category,
        z.number().int().positive(),
      ]),
    ) as Record<BonusCategory, z.ZodNumber>,
  )
  .partial();

export const sessionSettingsPartialSchema = z
  .object({
    lockGraceSeconds: z.number().int().positive(),
    enabledBonusCategories: z
      .array(z.enum(BONUS_CATEGORIES as [BonusCategory, ...BonusCategory[]]))
      .min(1, 'At least one bonus category must stay enabled'),
    autoplayMedia: z.boolean(),
    playLockCountdownSound: z.boolean(),
    showRoundOverview: z.boolean(),
    jokersEnabled: z.boolean(),
    rules: z
      .array(z.string().trim().min(1).max(RULE_MAX_LENGTH))
      .max(MAX_RULES),
    maxBonusAwardsPerCategory: maxBonusAwardsPerCategorySchema,
    maxPlayersPerTeam: z.number().int().positive(),
    extraPlayerPenaltyPoints: z.number().int().nonnegative(),
    kahootQuestionTimerSeconds: z.number().int().positive().nullable(),
    collectFeedback: z.boolean(),
    funFactsEnabled: z.boolean(),
    listed: z.boolean(),
  })
  .partial()
  // Only catches a patch naming both; a patch naming one is checked against the
  // other, as stored, where the settings are merged (see SessionSettingsChanges).
  .refine((settings) => !hasJokersWithoutOverview(settings), {
    message: JOKERS_NEED_OVERVIEW_MESSAGE,
  });

export type SessionSettingsPartial = z.infer<
  typeof sessionSettingsPartialSchema
>;

/** Merges a validated partial over DEFAULT_SESSION_SETTINGS — used when a new session is created, so any field the admin didn't set falls back to today's hardcoded behavior. */
export function resolveSessionSettings(
  partial: SessionSettingsPartial,
): SessionSettings {
  return { ...DEFAULT_SESSION_SETTINGS, ...partial };
}
