import {
  BONUS_CATEGORIES,
  DEFAULT_SESSION_SETTINGS,
  type QuizStructureSummary,
  type SessionSettings,
} from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_EXPLANATIONS,
  BONUS_CATEGORY_LABELS,
} from '@/app/lib/bonus-categories';

/** The session settings the rules screen reads. */
export type RulesSettings = Pick<
  SessionSettings,
  | 'rules'
  | 'enabledBonusCategories'
  | 'maxPlayersPerTeam'
  | 'extraPlayerPenaltyPoints'
>;

/** Standalone, with no live session to read from: default house rules and team size, and no bonus bullets (those are session config). */
const STANDALONE_RULES_SETTINGS: RulesSettings = {
  rules: DEFAULT_SESSION_SETTINGS.rules,
  enabledBonusCategories: [],
  maxPlayersPerTeam: DEFAULT_SESSION_SETTINGS.maxPlayersPerTeam,
  extraPlayerPenaltyPoints: DEFAULT_SESSION_SETTINGS.extraPlayerPenaltyPoints,
};

interface RulesContentProps {
  /** Omitted when shown standalone with no live game session to read the structure from. */
  quizStructure?: QuizStructureSummary;
  /** The session's settings: `rules` is one bullet per entry, `enabledBonusCategories` appends a bullet per category with a fixed explanation (shot, selfie; "custom" has none), and `maxPlayersPerTeam` with `extraPlayerPenaltyPoints` make a generated bullet shown first. Omitted when there is no live session. */
  settings?: RulesSettings;
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
  settings = STANDALONE_RULES_SETTINGS,
}: RulesContentProps) {
  const {
    rules,
    enabledBonusCategories,
    maxPlayersPerTeam,
    extraPlayerPenaltyPoints,
  } = settings;
  const bonusRules = BONUS_CATEGORIES.filter(
    (category) =>
      enabledBonusCategories.includes(category) &&
      BONUS_CATEGORY_EXPLANATIONS[category] !== undefined,
  ).map(
    (category) =>
      `${BONUS_CATEGORY_LABELS[category]} bonus: ${BONUS_CATEGORY_EXPLANATIONS[category]}`,
  );
  const teamSizeRule = `Max ${maxPlayersPerTeam} players per team, every additional player costs the team −${extraPlayerPenaltyPoints} points.`;
  const displayedRules = [teamSizeRule, ...rules, ...bonusRules];

  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="font-display text-display-3xl">
        <span className="text-magenta">Rules</span>
      </h1>
      {quizStructure && (
        <p className="text-balance font-display text-display-xl">
          {getQuizStructureText(quizStructure)}
        </p>
      )}
      <ul className="mx-auto flex max-w-[calc(36rem*var(--display-text-scale,1))] flex-col gap-3 text-left">
        {displayedRules.map((rule) => (
          <li
            key={rule}
            className="flex items-start gap-3 text-display-lg font-bold"
          >
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
