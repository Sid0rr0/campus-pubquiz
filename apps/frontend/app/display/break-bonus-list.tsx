import {
  BONUS_CATEGORIES,
  type BonusCategory,
  type QuizStructureSummary,
} from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_EXPLANATIONS,
  BONUS_CATEGORY_LABELS,
  DEFAULT_BONUS_POINTS,
  getBonusEarnDeadlineText,
} from '@/app/lib/bonus-categories';

interface BreakBonusListProps {
  /** This session's enabled bonus categories — "custom" is never listed, same as BonusProgressList, since it has no fixed explanation to show. */
  enabledCategories: BonusCategory[];
  /** Drives the "can be earned until the end of break X" caption's break number. */
  quizStructure: QuizStructureSummary;
}

/**
 * Big-screen "what you can still go earn" list, shown on the break screen
 * while grading happens off-screen. Unlike BonusProgressList (the /play
 * sidebar), this is audience-facing rather than team-specific — no
 * per-team awarded counts, since the display has no single team to count
 * for.
 */
export function BreakBonusList({
  enabledCategories,
  quizStructure,
}: BreakBonusListProps) {
  const predefinedCategories = BONUS_CATEGORIES.filter(
    (category) => category !== 'custom' && enabledCategories.includes(category),
  );

  if (predefinedCategories.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        BONUS POINTS AVAILABLE
      </p>
      <p className="-mt-2 text-sm text-foreground/55">
        {getBonusEarnDeadlineText(quizStructure)}
      </p>
      <ul className="flex flex-col gap-3">
        {predefinedCategories.map((category) => (
          <li
            key={category}
            className="rounded-xl border border-foreground/15 bg-white px-5 py-3 text-left"
          >
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-display text-lg">
                {BONUS_CATEGORY_LABELS[category]}
              </span>
              <span className="shrink-0 text-sm font-extrabold text-magenta">
                +{DEFAULT_BONUS_POINTS} pt each
              </span>
            </p>
            <p className="mt-1 text-base text-foreground/70">
              {BONUS_CATEGORY_EXPLANATIONS[category]}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
