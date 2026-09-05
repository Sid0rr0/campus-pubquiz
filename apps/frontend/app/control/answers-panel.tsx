'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type {
  AnswerView,
  AnswersUpdatedPayload,
  QuestionType,
  TeamView,
} from '@campus-pubquiz/types';
import { formatAnswerValue } from '@/app/lib/format-answer-value';
import { Button } from '@/app/components/button';

interface GradeOption {
  display: string;
  ariaSuffix: string;
  value: number;
}

function gradeOptions(maxPoints: number): GradeOption[] {
  return [
    { display: '0', ariaSuffix: '0 points', value: 0 },
    { display: '½', ariaSuffix: 'half points', value: maxPoints / 2 },
    { display: String(maxPoints), ariaSuffix: 'full points', value: maxPoints },
  ];
}

interface AnswerRowProps {
  teamName: string;
  answer: AnswerView | null;
  questionType: QuestionType;
  /** match only: the left-hand items, so the team's right-hand picks can be paired back to them for display. */
  questionOptions?: string[];
  maxPoints: number;
  /** closest_guess is graded automatically — show its computed result instead of grade buttons, and never call onGrade. */
  readOnly: boolean;
  onGrade: (answerId: number, points: number) => void;
}

function AnswerRow({
  teamName,
  answer,
  questionType,
  questionOptions,
  maxPoints,
  readOnly,
  onGrade,
}: AnswerRowProps) {
  const hasAnswered = answer !== null;
  const isGraded = hasAnswered && answer.gradedAt !== null;
  const options = gradeOptions(maxPoints);
  const matchesAGradeOption =
    hasAnswered &&
    options.some((option) => option.value === answer.pointsAwarded);

  return (
    <li
      className={
        hasAnswered
          ? 'flex items-center gap-3.5 rounded-xl border border-foreground/15 bg-white px-4 py-3'
          : 'flex items-center gap-3.5 rounded-xl border border-foreground/15 bg-white px-4 py-3 opacity-40'
      }
    >
      <span className="w-40 shrink-0 font-extrabold">{teamName}</span>
      <span className="flex-1 text-[15px]">
        {hasAnswered
          ? formatAnswerValue(answer.value, questionType, questionOptions)
          : 'No answer yet'}
      </span>
      {readOnly ? (
        <span className="text-sm font-extrabold text-foreground/55">
          {hasAnswered ? `${answer.pointsAwarded} pts (auto-graded)` : ''}
        </span>
      ) : (
        <>
          {isGraded && !matchesAGradeOption && (
            <span className="sr-only">
              Awarded {answer.pointsAwarded} points
            </span>
          )}
          <div className="flex gap-1.5">
            {options.map(({ display, ariaSuffix, value }) => {
              const isSelected = isGraded && answer.pointsAwarded === value;
              return (
                <Button
                  key={display}
                  type="button"
                  disabled={!hasAnswered}
                  variant={isSelected ? undefined : 'outline-muted'}
                  aria-label={`Grade ${teamName} ${ariaSuffix}`}
                  onClick={() => hasAnswered && onGrade(answer.answerId, value)}
                  className={
                    isSelected
                      ? 'flex h-9 min-w-11 items-center justify-center rounded-lg bg-green font-extrabold text-white'
                      : 'flex h-9 min-w-11 items-center justify-center'
                  }
                >
                  {isSelected ? `✓ ${value}` : display}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </li>
  );
}

interface AnswersPanelNav {
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

interface AnswersPanelProps {
  liveAnswers: AnswersUpdatedPayload;
  teams: TeamView[];
  onGrade: (answerId: number, points: number) => void;
  nav?: AnswersPanelNav;
}

export function AnswersPanel({
  liveAnswers,
  teams,
  onGrade,
  nav,
}: AnswersPanelProps) {
  const { question, answers } = liveAnswers;
  const answersByTeamId = new Map(
    answers.map((answer) => [answer.teamId, answer]),
  );
  const readOnly = question.type === 'closest_guess';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold tracking-wide text-foreground/55">
            Round {question.roundNumber} ({question.roundTitle}) — Q
            {question.questionNumberInRound} of {question.totalQuestionsInRound}
            {nav && ` — Grading ${nav.index + 1} of ${nav.total}`}
          </p>
          {nav && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline-muted"
                aria-label="Previous question"
                disabled={nav.index === 0}
                onClick={nav.onPrevious}
                className="flex h-10 min-w-11 items-center justify-center"
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline-muted"
                aria-label="Next question"
                disabled={nav.index >= nav.total - 1}
                onClick={nav.onNext}
                className="flex h-10 min-w-11 items-center justify-center"
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
        <h2 className="font-display text-xl">{question.prompt}</h2>
        <p className="text-sm font-bold text-green">
          Correct answer:{' '}
          {formatAnswerValue(
            question.correctAnswer,
            question.type,
            question.options,
          )}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {teams.map((team) => (
          <AnswerRow
            key={team.teamId}
            teamName={team.teamName}
            answer={answersByTeamId.get(team.teamId) ?? null}
            questionType={question.type}
            questionOptions={question.options}
            maxPoints={question.points}
            readOnly={readOnly}
            onGrade={onGrade}
          />
        ))}
      </ul>
    </section>
  );
}
