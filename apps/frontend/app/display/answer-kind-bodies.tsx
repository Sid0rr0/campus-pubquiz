import type { ReactNode } from 'react';
import {
  ANSWER_FORMATS,
  type AnswerKind,
  type QuestionView,
} from '@campus-pubquiz/types';
import {
  getLowerOptionLetter,
  getOptionLetter,
} from '@/app/lib/option-letters';

/** The fields the answer bodies read; a missing one means there is nothing to show. */
export type AnswerBodyQuestion = Pick<QuestionView, 'options' | 'matchTargets'>;

interface QuestionBodyProps {
  question: AnswerBodyQuestion;
}

interface RevealBodyProps {
  question: AnswerBodyQuestion;
  correctAnswer: string;
  /** Present (even when empty) once the team's own answer is shown instead of the answer key. */
  playerAnswer?: string;
}

/** A reveal split in two so the answer line sits above the media and the laid-out answer below it. */
interface RevealBody {
  lead?: ReactNode;
  body?: ReactNode;
}

const ITEM_CLASS =
  'flex items-center gap-3 rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-display-xl font-bold';

interface MatchRevealRowProps {
  isCorrect: boolean;
  leftLabel: string;
  left: string;
  rightLabel: string;
  right: string;
}

/** One matched pair on reveal. A fixed three-column grid keeps every arrow on the same vertical line regardless of text length. */
function MatchRevealRow({
  isCorrect,
  leftLabel,
  left,
  rightLabel,
  right,
}: MatchRevealRowProps) {
  const accentClass = isCorrect ? 'text-green' : 'text-magenta';
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 rounded-xl border-2 bg-white px-5 py-3 text-display-xl font-bold text-foreground ${
        isCorrect ? 'border-green' : 'border-magenta'
      }`}
    >
      <span className="flex items-baseline gap-3">
        <span className={`font-display ${accentClass}`}>{leftLabel}</span>
        <span>{left}</span>
      </span>
      <span aria-hidden="true" className={accentClass}>
        {isCorrect ? '→' : '✗'}
      </span>
      <span className="flex items-baseline gap-3">
        <span className={`font-display ${accentClass}`}>{rightLabel}</span>
        <span>{right}</span>
      </span>
    </li>
  );
}

function AnswerLine({ answer }: { answer: string }) {
  return (
    <p className="font-extrabold text-display-3xl">
      <span className="font-body text-foreground/55">Answer{': '}</span>
      {answer}
    </p>
  );
}

function ChoiceList({
  options,
  correctAnswer,
}: {
  options: readonly string[];
  correctAnswer?: string;
}) {
  return (
    <ul className="grid w-full max-w-3xl grid-cols-2 gap-4">
      {options.map((option, index) => {
        const isCorrect =
          correctAnswer !== undefined && option === correctAnswer;
        return (
          <li
            key={index}
            className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-left text-display-xl font-bold ${
              isCorrect ? 'border-green' : 'border-foreground/30'
            }`}
          >
            <span
              className={`font-display ${isCorrect ? 'text-green' : 'text-cyan'}`}
            >
              {getOptionLetter(index)}
            </span>
            <span className="text-foreground">{option}</span>
            {isCorrect && (
              <span aria-hidden="true" className="ml-auto text-green">
                ✓
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SortList({
  items,
  correctOrder,
}: {
  items: readonly string[];
  correctOrder: readonly string[];
}) {
  return (
    <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
      {items.map((item, index) => {
        const isCorrect = item === correctOrder[index];
        return (
          <li
            key={index}
            className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-display-xl font-bold ${
              isCorrect ? 'border-green' : 'border-magenta'
            }`}
          >
            <span
              className={`font-display ${isCorrect ? 'text-green' : 'text-magenta'}`}
            >
              {index + 1}
            </span>
            <span className="text-foreground">{item}</span>
            <span
              aria-hidden="true"
              className={`ml-auto ${isCorrect ? 'text-green' : 'text-magenta'}`}
            >
              {isCorrect ? '✓' : '✗'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const noQuestionBody = () => null;

function ChoiceQuestionBody({ question: { options } }: QuestionBodyProps) {
  return options ? <ChoiceList options={options} /> : null;
}

function SortQuestionBody({ question: { options } }: QuestionBodyProps) {
  if (!options) return null;
  return (
    <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
      {options.map((item, index) => (
        <li key={index} className={ITEM_CLASS}>
          <span className="font-display text-cyan">{index + 1}</span>
          <span className="text-foreground">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function MatchQuestionBody({
  question: { options, matchTargets },
}: QuestionBodyProps) {
  if (!options || !matchTargets) return null;
  return (
    <div className="grid w-full max-w-3xl grid-cols-2 gap-4 text-left">
      <ul className="flex flex-col gap-3">
        {options.map((item, index) => (
          <li key={index} className={`${ITEM_CLASS} text-foreground`}>
            <span className="font-display text-cyan">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-3">
        {matchTargets.map((item, index) => (
          <li key={index} className={`${ITEM_CLASS} text-foreground`}>
            <span className="font-display text-cyan">
              {getLowerOptionLetter(index)}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the big screen shows while a question is being asked, beyond its prompt and media. */
export const QUESTION_BODIES = {
  text: noQuestionBody,
  number: noQuestionBody,
  choice: ChoiceQuestionBody,
  sort: SortQuestionBody,
  match: MatchQuestionBody,
} satisfies {
  readonly [K in AnswerKind]: (props: QuestionBodyProps) => ReactNode;
};

function sortRevealBody({
  correctAnswer,
  playerAnswer,
}: RevealBodyProps): RevealBody {
  // An empty key means there is nothing to show, for the key and for a team's answer alike.
  if (!correctAnswer) return {};
  const correctOrder = ANSWER_FORMATS.sort.decode(correctAnswer);
  const shownOrder =
    playerAnswer === undefined
      ? correctOrder
      : ANSWER_FORMATS.sort.decode(playerAnswer);
  if (shownOrder.length !== correctOrder.length) return {};
  return { body: <SortList items={shownOrder} correctOrder={correctOrder} /> };
}

function matchRevealBody({
  question: { options, matchTargets },
  correctAnswer,
  playerAnswer,
}: RevealBodyProps): RevealBody {
  if (!options || !correctAnswer) return {};
  const correctRights = ANSWER_FORMATS.match.decode(correctAnswer);
  const shownRights =
    playerAnswer === undefined
      ? correctRights
      : ANSWER_FORMATS.match.decode(playerAnswer);
  if (playerAnswer !== undefined && shownRights.length !== options.length) {
    return {};
  }
  return {
    body: (
      <ul className="flex w-full max-w-6xl flex-col gap-3 text-left">
        {options.map((left, index) => {
          const right = shownRights[index];
          const rightLetterIndex = matchTargets?.indexOf(right) ?? index;
          return (
            <MatchRevealRow
              key={index}
              isCorrect={right === correctRights[index]}
              leftLabel={String(index + 1)}
              left={left}
              rightLabel={getLowerOptionLetter(
                rightLetterIndex >= 0 ? rightLetterIndex : index,
              )}
              right={right}
            />
          );
        })}
      </ul>
    ),
  };
}

function typedRevealBody({ correctAnswer }: RevealBodyProps): RevealBody {
  return { lead: <AnswerLine answer={correctAnswer} /> };
}

function choiceRevealBody({
  question: { options },
  correctAnswer,
}: RevealBodyProps): RevealBody {
  return {
    lead: <AnswerLine answer={correctAnswer} />,
    body: options && (
      <ChoiceList options={options} correctAnswer={correctAnswer} />
    ),
  };
}

/** What the big screen shows at reveal: the correct answer, or a team's own answer laid out the same way. */
export const REVEAL_BODIES = {
  text: typedRevealBody,
  number: typedRevealBody,
  choice: choiceRevealBody,
  sort: sortRevealBody,
  match: matchRevealBody,
} satisfies {
  readonly [K in AnswerKind]: (props: RevealBodyProps) => RevealBody;
};
