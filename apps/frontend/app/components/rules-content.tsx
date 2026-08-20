import {
  BONUS_CATEGORIES,
  DEFAULT_SESSION_SETTINGS,
  type BonusCategory,
  type QuizStructureSummary,
} from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_EXPLANATIONS,
  BONUS_CATEGORY_LABELS,
} from '@/app/lib/bonus-categories';

interface RulesContentProps {
  /** Omitted when shown standalone with no live game session to read the structure from. */
  quizStructure?: QuizStructureSummary;
  /** One entry per rendered bullet line — defaults to DEFAULT_SESSION_SETTINGS.rules when no live session's settings are available. */
  rules?: string[];
  /** This session's SessionSettings.enabledBonusCategories — appends one bullet per enabled category that has a fixed explanation (shot, selfie), since that's session config rather than part of the admin-authored `rules` text. "custom" has no fixed explanation and is never appended. */
  enabledBonusCategories?: BonusCategory[];
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function structureSentence({
  blockCount,
  topicsPerBlock,
}: QuizStructureSummary): string {
  const rounds = `${blockCount} ${pluralize(blockCount, 'round')}`;
  if (topicsPerBlock === null) {
    return `There will be ${rounds}, with a break in between.`;
  }
  const topics = `${topicsPerBlock} ${pluralize(topicsPerBlock, 'topic')}`;
  return `There will be ${rounds} of ${topics} with a break in between.`;
}

export function RulesContent({
  quizStructure,
  rules = DEFAULT_SESSION_SETTINGS.rules,
  enabledBonusCategories = [],
}: RulesContentProps) {
  const bonusRules = BONUS_CATEGORIES.filter(
    (category) =>
      enabledBonusCategories.includes(category) &&
      BONUS_CATEGORY_EXPLANATIONS[category] !== undefined,
  ).map(
    (category) =>
      `${BONUS_CATEGORY_LABELS[category]} bonus: ${BONUS_CATEGORY_EXPLANATIONS[category]}`,
  );
  const displayedRules = [...rules, ...bonusRules];

  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="font-display text-3xl">
        <span className="text-magenta">Rules</span>
      </h1>
      {quizStructure && (
        <p className="text-balance font-display text-xl">
          {structureSentence(quizStructure)}
        </p>
      )}
      <ul className="mx-auto flex max-w-xl flex-col gap-3 text-left">
        {displayedRules.map((rule) => (
          <li key={rule} className="flex items-start gap-3 text-lg font-bold">
            <span aria-hidden="true" className="text-cyan">
              •
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
