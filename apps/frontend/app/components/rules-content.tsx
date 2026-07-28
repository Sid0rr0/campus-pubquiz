import type { QuizStructureSummary } from '@campus-pubquiz/types';

interface RulesContentProps {
  quizStructure: QuizStructureSummary;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function structureSentence({ blockCount, topicsPerBlock }: QuizStructureSummary): string {
  const rounds = `${blockCount} ${pluralize(blockCount, 'round')}`;
  if (topicsPerBlock === null) {
    return `There will be ${rounds}, with a break in between.`;
  }
  const topics = `${topicsPerBlock} ${pluralize(topicsPerBlock, 'topic')}`;
  return `There will be ${rounds} of ${topics} with a break in between.`;
}

const RULES = [
  'Max 6 players per team — every additional player costs the team −2 points.',
  'No cheating.',
  'Please write your answers in English (Czech and Slovak also accepted if necessary).',
  'In case of disagreements, the organizers have the final word.',
  'Want to contest something? Come with a credible source.',
];

export function RulesContent({ quizStructure }: RulesContentProps) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="font-display text-3xl">
        <span className="text-magenta">Rules</span>
      </h1>
      <p className="text-balance font-display text-xl">{structureSentence(quizStructure)}</p>
      <ul className="mx-auto flex max-w-xl flex-col gap-3 text-left">
        {RULES.map((rule) => (
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
