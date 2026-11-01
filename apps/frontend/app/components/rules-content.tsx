import {
  BONUS_CATEGORIES,
  CARRIED_COINS,
  SHOT_SELFIE_COINS,
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
  | 'jokersEnabled'
> &
  Partial<Pick<SessionSettings, 'powerUpsEnabled' | 'startingCoins'>>;

const JOKER_RULE =
  "Joker: pick one round to score double. You'll choose after the round overview.";

const CARRIED_COIN_RULE = `You have ${CARRIED_COINS} coins for rating every round of your last league night. Spend them on power-ups.`;

/** Standalone, with no live session to read from: default house rules and team size, and no bonus bullets (those are session config). */
const STANDALONE_RULES_SETTINGS: RulesSettings = {
  rules: DEFAULT_SESSION_SETTINGS.rules,
  enabledBonusCategories: [],
  maxPlayersPerTeam: DEFAULT_SESSION_SETTINGS.maxPlayersPerTeam,
  extraPlayerPenaltyPoints: DEFAULT_SESSION_SETTINGS.extraPlayerPenaltyPoints,
  jokersEnabled: false,
};

interface RulesContentProps {
  /** Omitted when shown standalone with no live game session to read the structure from. */
  quizStructure?: QuizStructureSummary;
  /** The session's settings: `rules` is one bullet per entry, `enabledBonusCategories` appends a bullet per category with a fixed explanation (shot, selfie; "custom" has none), and `maxPlayersPerTeam` with `extraPlayerPenaltyPoints` make a generated bullet shown first, and `jokersEnabled` appends the joker line. Omitted when there is no live session. */
  settings?: RulesSettings;
  /** The viewing team holds a carried coin (phone only): with power-ups off, the rules say it can still be spent. */
  hasCarriedCoin?: boolean;
}

const COIN_AMOUNT = /(\d+ points? \+ \d+ coins?|\d+ coins?)/;

/** The rule's text with coin amounts ("2 coins", "1 point + 2 coins") picked out in colour. */
function highlightCoins(rule: string) {
  return rule.split(COIN_AMOUNT).map((part, index) =>
    // split() with one capture group puts the matches at the odd indices
    index % 2 === 1 ? (
      <strong key={index} className="font-black text-magenta">
        {part}
      </strong>
    ) : (
      part
    ),
  );
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
  hasCarriedCoin = false,
}: RulesContentProps) {
  const {
    rules,
    enabledBonusCategories,
    maxPlayersPerTeam,
    extraPlayerPenaltyPoints,
    jokersEnabled,
    powerUpsEnabled,
    startingCoins = 0,
  } = settings;
  const bonusRules = BONUS_CATEGORIES.filter(
    (category) =>
      enabledBonusCategories.includes(category) &&
      BONUS_CATEGORY_EXPLANATIONS[category] !== undefined,
  ).map((category) => {
    const explanation = BONUS_CATEGORY_EXPLANATIONS[category];
    return `${BONUS_CATEGORY_LABELS[category]} bonus: ${
      powerUpsEnabled
        ? explanation?.replace(
            '(1 point',
            `(1 point + ${SHOT_SELFIE_COINS} coins`,
          )
        : explanation
    }`;
  });
  const teamSizeRule = `Max ${maxPlayersPerTeam} players per team, every additional player costs the team −${extraPlayerPenaltyPoints} points.`;
  const displayedRules = [
    teamSizeRule,
    ...rules,
    ...bonusRules,
    ...(jokersEnabled ? [JOKER_RULE] : []),
    ...(powerUpsEnabled
      ? [
          `Power-ups are on: you start with ${startingCoins} ${pluralize(startingCoins, 'coin')}. If your team rated all rounds of the last pub quiz, you get ${CARRIED_COINS} bonus coins. Earn more with shots and selfies.`,
        ]
      : hasCarriedCoin
        ? [CARRIED_COIN_RULE]
        : []),
  ];

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
            <span>{highlightCoins(rule)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
