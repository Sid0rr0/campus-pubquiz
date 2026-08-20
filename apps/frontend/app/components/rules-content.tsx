import {
  DEFAULT_SESSION_SETTINGS,
  type QuizStructureSummary,
} from '@campus-pubquiz/types';

interface RulesContentProps {
  /** Omitted when shown standalone with no live game session to read the structure from. */
  quizStructure?: QuizStructureSummary;
  /** One entry per rendered bullet line — defaults to DEFAULT_SESSION_SETTINGS.rules when no live session's settings are available. */
  rules?: string[];
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
}: RulesContentProps) {
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
        {rules.map((rule) => (
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
