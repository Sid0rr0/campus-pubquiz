import {
  BONUS_CATEGORIES,
  type BonusCategory,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_EXPLANATIONS,
  BONUS_CATEGORY_LABELS,
  DEFAULT_BONUS_POINTS,
} from '@/app/lib/bonus-categories';

interface BonusProgressListProps {
  /** This session's enabled bonus categories — "custom" is deliberately never listed here as "available", since it has no fixed explanation and isn't something a team can go earn on demand. */
  enabledCategories: BonusCategory[];
  /** Caps how many times each category may be awarded per team this session, from SessionSettings.maxBonusAwardsPerCategory — a category absent here has no cap. */
  maxAwardsPerCategory: Partial<Record<BonusCategory, number>>;
  /** This team's own bonus awards so far this session. */
  myBonusAwards: TeamBonusAwardView[];
}

export function BonusProgressList({
  enabledCategories,
  maxAwardsPerCategory,
  myBonusAwards,
}: BonusProgressListProps) {
  const predefinedCategories = BONUS_CATEGORIES.filter(
    (category) => category !== 'custom' && enabledCategories.includes(category),
  );
  const customAwards = myBonusAwards.filter(
    (award) => award.category === 'custom',
  );

  if (predefinedCategories.length === 0 && customAwards.length === 0) {
    return (
      <p className="text-sm text-foreground/55">
        No bonus points available this session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {predefinedCategories.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {predefinedCategories.map((category) => {
            const awardedCount = myBonusAwards.filter(
              (award) => award.category === category,
            ).length;
            const cap = maxAwardsPerCategory[category];
            return (
              <li
                key={category}
                className="rounded-xl border border-foreground/15 bg-white px-4 py-3"
              >
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold">
                    {BONUS_CATEGORY_LABELS[category]}
                  </span>
                  <span className="shrink-0 text-xs font-extrabold text-foreground/45">
                    +{DEFAULT_BONUS_POINTS} pt each
                  </span>
                </p>
                <p className="mt-1 text-sm text-foreground/70">
                  {BONUS_CATEGORY_EXPLANATIONS[category]}
                </p>
                <p className="mt-1.5 text-sm">
                  <span className="font-extrabold text-foreground/55">
                    Awarded:{' '}
                  </span>
                  {awardedCount}
                  {cap !== undefined ? ` / ${cap}` : ''} times
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {customAwards.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {customAwards.map((award, index) => (
            // Custom awards have no server-side id in this view — index is
            // stable since myBonusAwards only ever grows, never reorders.
            <li
              key={index}
              className="rounded-xl border border-foreground/15 bg-white px-4 py-3"
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold">Bonus</span>
                <span className="shrink-0 text-xs font-extrabold text-foreground/45">
                  +{award.points} pt
                </span>
              </p>
              <p className="mt-1 text-sm text-foreground/70">{award.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
