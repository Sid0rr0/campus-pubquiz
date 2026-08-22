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

/** "2" / "2 and 5" / "2, 5 and 7" */
function formatRoundNumberList(roundNumbers: number[]): string {
  if (roundNumbers.length === 1) {
    return `${roundNumbers[0]}`;
  }
  const last = roundNumbers[roundNumbers.length - 1];
  const rest = roundNumbers.slice(0, -1).join(', ');
  return `${rest} and ${last}`;
}

function getQuizStructureText({
  topicsPerBlock,
  breakRoundNumbers,
  minQuestionsPerTopic,
  maxQuestionsPerTopic,
}: QuizStructureSummary): string {
  const totalTopics = breakRoundNumbers[breakRoundNumbers.length - 1] ?? 0;
  const topics = `${totalTopics} ${pluralize(totalTopics, 'topic')}`;
  const questionsClause =
    totalTopics === 0
      ? ''
      : minQuestionsPerTopic === maxQuestionsPerTopic
        ? `, ${minQuestionsPerTopic} ${pluralize(minQuestionsPerTopic, 'question')} each`
        : `, ${minQuestionsPerTopic} to ${maxQuestionsPerTopic} questions each`;
  if (breakRoundNumbers.length === 0) {
    return `There will be ${topics}${questionsClause}, with a break in between.`;
  }
  if (topicsPerBlock !== null) {
    const interval =
      topicsPerBlock === 1 ? 'each round' : `every ${topicsPerBlock} rounds`;
    return `There will be ${topics}${questionsClause}, with a break after ${interval}.`;
  }
  return `There will be ${topics}${questionsClause}, with a break after round ${formatRoundNumberList(breakRoundNumbers)}.`;
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
          {getQuizStructureText(quizStructure)}
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
