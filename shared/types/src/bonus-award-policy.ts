import type { BonusCategory } from './bonus';
import { getBlockForNewAward } from './block-in-play';
import {
  bonusCoinsEarned,
  coinAwardRefusal,
  coinTakeRefusal,
  type CoinLedgerSession,
} from './coin-ledger';
import type { SessionState } from './session-state';

/** What the policy reads of a session: the Coin ledger's caches, the settings and where the quiz is. */
export type BonusAwardSession = CoinLedgerSession &
  Pick<SessionState, 'progress'> & {
    seededGame: Pick<SessionState['seededGame'], 'rounds'> & {
      settings: Pick<
        SessionState['seededGame']['settings'],
        'enabledBonusCategories' | 'maxBonusAwardsPerCategory'
      >;
    };
  };

/** What the quiz master asked for. */
export interface BonusAwardRequest {
  teamId: number;
  category: BonusCategory;
  points: number;
  reason?: string;
  /** The form's manual coins (may be negative, absent or 0 for none). */
  coins?: number;
}

/** What the bonus store persists for one award, in one flush. */
export interface AwardToStore {
  /** Absent when the points are 0 (coins alone). */
  bonus?: {
    category: BonusCategory;
    points: number;
    /** Trimmed, and only for a custom award. */
    reason?: string;
    blockFirstQuestionId?: number;
  };
  /** The shot/selfie coins the bonus earns, linked to it; 0 when none. */
  linkedCoins: number;
  manualCoins: number;
  /** The trimmed reason the manual coins carry. */
  manualCoinsReason?: string;
}

export type BonusAwardDecision = { refusal: string } | { award: AwardToStore };

/** What only the database knows: the stored roster (the session's `teams` misses teams not rejoined since a restart) and the team's award count in the category. */
export interface BonusAwardFacts {
  isOnRoster: boolean;
  existingCount: number;
}

/**
 * Whether the quiz master may give this award, and what is then stored.
 * Refusals come in a fixed order, so the same message shows when several rules fail.
 */
export function decideBonusAward(
  session: BonusAwardSession,
  request: BonusAwardRequest,
  facts: BonusAwardFacts,
): BonusAwardDecision {
  const refusal = awardRefusal(session, request, facts);
  return refusal ? { refusal } : { award: awardToStore(session, request) };
}

/** The first rule the award fails, in the fixed order. */
function awardRefusal(
  session: BonusAwardSession,
  { teamId, category, points, reason, coins }: BonusAwardRequest,
  { isOnRoster, existingCount }: BonusAwardFacts,
): string | undefined {
  const { settings } = session.seededGame;
  const trimmedReason = reason?.trim();
  // Category, reason and cap apply only to a bonus award, not to coins alone.
  const givesPoints = points !== 0;
  const rules: (() => string | undefined)[] = [
    () => coinAwardRefusal(session, coins),
    () => coinTakeRefusal(session, teamId, coins),
    () => amountsRefusal(points, coins ?? 0),
    () =>
      givesPoints
        ? categoryRefusal(category, trimmedReason, settings)
        : undefined,
    () => (isOnRoster ? undefined : 'Team is not part of this game session'),
    () =>
      givesPoints
        ? capRefusal(
            category,
            existingCount,
            settings.maxBonusAwardsPerCategory,
          )
        : undefined,
  ];
  for (const rule of rules) {
    const refusal = rule();
    if (refusal) return refusal;
  }
  return undefined;
}

function awardToStore(
  session: BonusAwardSession,
  { category, points, reason, coins }: BonusAwardRequest,
): AwardToStore {
  const trimmedReason = reason?.trim();
  // Points of 0 give coins alone: no bonus award is stored.
  const givesPoints = points !== 0;
  return {
    bonus: givesPoints
      ? {
          category,
          points,
          reason: category === 'custom' ? trimmedReason : undefined,
          blockFirstQuestionId: getBlockForNewAward(
            session.seededGame.rounds,
            session.progress,
          ),
        }
      : undefined,
    linkedCoins: givesPoints
      ? bonusCoinsEarned(
          session.seededGame.settings.powerUpsEnabled,
          category,
          points,
        )
      : 0,
    manualCoins: coins ?? 0,
    manualCoinsReason: trimmedReason || undefined,
  };
}

function amountsRefusal(
  points: number,
  manualCoins: number,
): string | undefined {
  return !Number.isFinite(points) || (points === 0 && manualCoins === 0)
    ? 'Bonus points must be a non-zero number'
    : undefined;
}

function categoryRefusal(
  category: BonusCategory,
  trimmedReason: string | undefined,
  settings: BonusAwardSession['seededGame']['settings'],
): string | undefined {
  if (!settings.enabledBonusCategories.includes(category)) {
    return `"${category}" is not enabled for this session`;
  }
  return category === 'custom' && !trimmedReason
    ? 'A custom bonus needs a reason'
    : undefined;
}

function capRefusal(
  category: BonusCategory,
  existingCount: number,
  caps: BonusAwardSession['seededGame']['settings']['maxBonusAwardsPerCategory'],
): string | undefined {
  const cap = caps[category];
  return cap !== undefined && existingCount >= cap
    ? `This team has already been awarded the "${category}" bonus the maximum ${cap} time(s)`
    : undefined;
}

export type BonusEditDecision =
  | { refusal: string }
  | { points: number; reason: string | undefined };

/** Whether an award may be edited to these points and reason, and what is then stored (the reason only for custom). */
export function decideBonusEdit(
  stored: { category: BonusCategory; points: number },
  points: number,
  reason: string | undefined,
): BonusEditDecision {
  if (!Number.isFinite(points) || points === 0) {
    return { refusal: 'Bonus points must be a non-zero number' };
  }
  const trimmedReason = reason?.trim();
  if (stored.category === 'custom' && !trimmedReason) {
    return { refusal: 'A custom bonus needs a reason' };
  }
  // A shot or selfie bonus brings coins and a penalty brings none, so the
  // linked coin award would go stale if the sign flipped.
  if (
    stored.category !== 'custom' &&
    Math.sign(points) !== Math.sign(stored.points)
  ) {
    return {
      refusal:
        'A shot or selfie award cannot change between a bonus and a penalty — delete it and give a new one',
    };
  }
  return {
    points,
    reason: stored.category === 'custom' ? trimmedReason : undefined,
  };
}
