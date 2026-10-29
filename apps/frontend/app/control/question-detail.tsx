'use client';

import {
  formatAnswer,
  resolveAnswerKind,
  type AnswerKind,
  type AnswersUpdatedPayload,
  type QuestionType,
  type QuestionView,
  type QuizSummaryRound,
} from '@campus-pubquiz/types';
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
  const roundIndex = rounds.findIndex((round) =>
    round.questions.some((question) => question.id === questionId),
  );
  const round = rounds[roundIndex];
  const questionIndex = round?.questions.findIndex(
    (question) => question.id === questionId,
  );
  const stored = round?.questions[questionIndex];
  const roundLine = live
    ? `Round ${live.roundNumber} (${live.roundTitle}) — Q${live.questionNumberInRound} of ${live.totalQuestionsInRound}`
    : round &&
      `Round ${roundIndex + 1} (${round.title}) — Q${questionIndex + 1} of ${round.questions.length}`;
  const prompt =
    live?.prompt ??
    stored?.prompt ??
    fallbackQuestions.find((question) => question.id === questionId)?.prompt;
  if (prompt === undefined) return null;
  return {
    prompt,
    type: live?.type ?? stored?.type,
    correctAnswer: live?.correctAnswer ?? stored?.answer,
    options: live?.options ?? stored?.options,
    matchTargets: live?.matchTargets ?? stored?.matchTargets,
    notes: stored?.notes,
    roundLine: roundLine || undefined,
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
  const { type, correctAnswer, options, matchTargets } = detail;
  const headings = type && OPTION_HEADINGS[resolveAnswerKind({ type })];

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
      {headings && options && (
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
      )}
    </section>
  );
}
