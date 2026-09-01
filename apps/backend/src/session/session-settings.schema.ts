import { z } from 'zod';
import {
  BONUS_CATEGORIES,
  DEFAULT_SESSION_SETTINGS,
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
    rules: z
      .array(z.string().trim().min(1).max(RULE_MAX_LENGTH))
      .max(MAX_RULES),
    maxBonusAwardsPerCategory: maxBonusAwardsPerCategorySchema,
  })
  .partial();

export type SessionSettingsPartial = z.infer<
  typeof sessionSettingsPartialSchema
>;

/** Merges a validated partial over DEFAULT_SESSION_SETTINGS — used when a new session is created, so any field the admin didn't set falls back to today's hardcoded behavior. */
export function resolveSessionSettings(
  partial: SessionSettingsPartial,
): SessionSettings {
  return { ...DEFAULT_SESSION_SETTINGS, ...partial };
}
