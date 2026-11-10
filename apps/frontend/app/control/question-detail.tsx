'use client';

import {
  QUESTION_KINDS,
  formatAnswer,
  resolveAnswerKind,
  type AnswerKind,
  type AnswersUpdatedPayload,
  type QuestionType,
  type QuestionView,
  type QuizSummaryRound,
} from '@campus-pubquiz/types';
import { AllCluesList } from '@/app/control/all-clues-list';
import { NotesLine } from '@/app/control/notes-line';

interface QuestionDetailProps {
  questionId: number | null;
  rounds: QuizSummaryRound[];
  liveAnswers: AnswersUpdatedPayload | null;
  /**
   * Questions from the live snapshot (current + just-locked block) — a
   * prompt source for the loading gap before the round list or the
   * ANSWERS_UPDATED roundtrip has arrived.
   */
  fallbackQuestions: QuestionView[];
  /** The highest clue shown, when the question is the Clue question on air. */
  highestClue?: number;
}

/** What the column draws; every field but the prompt is missing while data is still loading. */
interface DetailData {
  prompt: string;
  type?: QuestionType;
  correctAnswer?: string;
  options?: string[];
  matchTargets?: string[];
  notes?: string;
  roundLine?: string;
}

// Heading of the option list(s) each answer kind shows; kinds without one show no options section.
const OPTION_HEADINGS: Partial<Record<AnswerKind, [string, string?]>> = {
  choice: ['Choices'],
  sort: ['Items'],
  match: ['Left items', 'Match targets'],
};

function resolveDetail({
  questionId,
  rounds,
  liveAnswers,
  fallbackQuestions,
}: QuestionDetailProps): DetailData | null {
  if (questionId === null) return null;
  const live =
    liveAnswers?.questionId === questionId ? liveAnswers.question : undefined;
  const stored = findStoredQuestion(rounds, questionId);
  const prompt = promptOf(
    live ?? stored?.question,
    fallbackQuestions,
    questionId,
  );
  if (prompt === undefined) return null;
  return {
    prompt,
    ...(live ? liveFields(live, stored?.question) : storedFields(stored)),
  };
}

/** The prompt from the live or stored question, else from the snapshot's questions while those load. */
function promptOf(
  known: { prompt: string } | undefined,
  fallbackQuestions: readonly QuestionView[],
  questionId: number,
): string | undefined {
  return (
    known?.prompt ??
    fallbackQuestions.find((question) => question.id === questionId)?.prompt
  );
}

type LiveQuestion = NonNullable<AnswersUpdatedPayload['question']>;
type StoredQuestion = QuizSummaryRound['questions'][number];

/** The question in the quiz's rounds, with the line naming where it sits. */
function findStoredQuestion(
  rounds: readonly QuizSummaryRound[],
  questionId: number,
): { question: StoredQuestion; roundLine: string } | undefined {
  for (const [roundIndex, round] of rounds.entries()) {
    const questionIndex = round.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (questionIndex !== -1) {
      return {
        question: round.questions[questionIndex],
        roundLine: `Round ${roundIndex + 1} (${round.title}) — Q${questionIndex + 1} of ${round.questions.length}`,
      };
    }
  }
  return undefined;
}

/** The live question's fields, the stored question filling what it lacks (and the notes, which only it has). */
function liveFields(
  live: LiveQuestion,
  stored: StoredQuestion | undefined,
): Omit<DetailData, 'prompt'> {
  return {
    type: live.type,
    correctAnswer: live.correctAnswer,
    options: live.options ?? stored?.options,
    matchTargets: live.matchTargets ?? stored?.matchTargets,
    notes: stored?.notes,
    roundLine: `Round ${live.roundNumber} (${live.roundTitle}) — Q${live.questionNumberInRound} of ${live.totalQuestionsInRound}`,
  };
}

function storedFields(
  stored: ReturnType<typeof findStoredQuestion>,
): Omit<DetailData, 'prompt'> {
  if (!stored) return {};
  const { question, roundLine } = stored;
  return {
    type: question.type,
    correctAnswer: question.answer,
    options: question.options,
    matchTargets: question.matchTargets,
    notes: question.notes,
    roundLine,
  };
}

function OptionList({
  heading,
  items,
  correct,
}: {
  heading: string;
  items: string[];
  correct?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-extrabold tracking-wide text-foreground/55">
        {heading}
      </h3>
      <ul aria-label={heading} className="flex flex-col gap-1 text-sm">
        {items.map((item, index) => {
          const isCorrect = item === correct;
          return (
            <li
              key={`${item}-${index}`}
              data-correct={isCorrect ? 'true' : undefined}
              className={
                isCorrect
                  ? 'rounded-lg border-2 border-green bg-green/10 px-3 py-1 font-extrabold'
                  : 'rounded-lg border border-foreground/15 bg-white px-3 py-1'
              }
            >
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function QuestionDetail(props: QuestionDetailProps) {
  const detail = resolveDetail(props);
  if (!detail) return null;
  const { type, correctAnswer, options } = detail;

  return (
    <section
      aria-label="Question detail"
      className="flex flex-col gap-2 break-words"
    >
      {detail.roundLine && (
        <p className="text-xs font-extrabold tracking-wide text-foreground/55">
          {detail.roundLine}
        </p>
      )}
      <h2 className="font-display text-xl">{detail.prompt}</h2>
      {type && correctAnswer !== undefined && (
        <p className="text-sm font-bold text-green">
          Correct answer: {formatAnswer(correctAnswer, { type, options })}
        </p>
      )}
      {detail.notes && <NotesLine notes={detail.notes} />}
      {type && options && (
        <OptionsSection
          {...detail}
          type={type}
          options={options}
          highestClue={props.highestClue}
        />
      )}
    </section>
  );
}

/** A Clue question's clues, or the option list(s) of a kind that has them; nothing for any other kind. */
function OptionsSection({
  type,
  options,
  matchTargets,
  correctAnswer,
  highestClue,
}: {
  type: QuestionType;
  options: string[];
  matchTargets?: string[];
  correctAnswer?: string;
  highestClue?: number;
}) {
  if (QUESTION_KINDS[type].hasClues) {
    return <AllCluesList clues={options} highestClue={highestClue} />;
  }
  const headings = OPTION_HEADINGS[resolveAnswerKind({ type })];
  return (
    headings && (
      <OptionLists
        headings={headings}
        options={options}
        matchTargets={matchTargets}
        correctAnswer={correctAnswer}
      />
    )
  );
}

function OptionLists({
  headings,
  options,
  matchTargets,
  correctAnswer,
}: {
  headings: [string, string?];
  options: string[];
  matchTargets: string[] | undefined;
  correctAnswer: string | undefined;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] items-start gap-3">
      <OptionList
        heading={headings[0]}
        items={options}
        correct={correctAnswer}
      />
      {headings[1] && matchTargets && (
        <OptionList heading={headings[1]} items={matchTargets} />
      )}
    </div>
  );
}
