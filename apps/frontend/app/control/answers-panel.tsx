'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { motion } from 'motion/react';
import {
  halfPoints,
  isBatchGradedType,
  type AnswerView,
  type AnswersUpdatedPayload,
  type QuestionType,
  type TeamView,
} from '@campus-pubquiz/types';
import { formatAnswerValue } from '@/app/lib/format-answer-value';
import { countCorrectAnswers } from '@/app/lib/count-correct-answers';
import { Button } from '@/app/components/button';
import { CustomGradeControl } from '@/app/control/custom-grade-control';

interface GradeOption {
  display: string;
  ariaSuffix: string;
  value: number;
}

// Lower sorts first: answers awaiting grading, then teams yet to answer,
// then already-graded answers.
function gradingSortRank(answer: AnswerView | null): number {
  if (answer === null) return 1;
  return answer.gradedAt === null ? 0 : 2;
}

function gradeOptions(maxPoints: number): GradeOption[] {
  const half = halfPoints(maxPoints);
  return [
    { display: '0', ariaSuffix: '0 points', value: 0 },
    {
      display: `Half (${half})`,
      ariaSuffix: 'half points',
      value: half,
    },
    {
      display: `Full (${maxPoints})`,
      ariaSuffix: 'full points',
      value: maxPoints,
    },
  ];
}

interface AnswerRowProps {
  teamName: string;
  answer: AnswerView | null;
  questionType: QuestionType;
  /** match only: the left-hand items, so the team's right-hand picks can be paired back to them for display. */
  questionOptions?: string[];
  maxPoints: number;
  /** closest_guess is graded automatically in one batch across all teams, so a single answer can't be overridden — show the computed result instead of grade buttons, and never call onGrade. (match is also auto-graded, but its per-pair partial credit stays editable through the normal grade controls.) */
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
    <motion.li
      layout
      transition={{ duration: 0.3, ease: 'easeOut' }}
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
          <div className="flex items-center gap-1.5">
            <CustomGradeControl
              teamName={teamName}
              currentAmount={hasAnswered ? answer.pointsAwarded : 0}
              isSelected={isGraded && !matchesAGradeOption}
              isDisabled={!hasAnswered}
              onConfirm={(amount) =>
                hasAnswered && onGrade(answer.answerId, amount)
              }
            />
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
                      ? 'flex h-9 min-w-11 items-center justify-center rounded-lg bg-green px-3 font-extrabold whitespace-nowrap text-white'
                      : 'flex h-9 min-w-11 items-center justify-center px-3 whitespace-nowrap'
                  }
                >
                  {isSelected ? `✓ ${display}` : display}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </motion.li>
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
  const readOnly = isBatchGradedType(question.type);
  const correctCount = countCorrectAnswers(liveAnswers);
  const answeredCount = answers.length;
  const sortedTeams = [...teams].sort(
    (a, b) =>
      gradingSortRank(answersByTeamId.get(a.teamId) ?? null) -
      gradingSortRank(answersByTeamId.get(b.teamId) ?? null),
  );

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
        <p className="flex gap-5 text-sm font-bold">
          <span className="text-green">
            Correct answer:{' '}
            {formatAnswerValue(
              question.correctAnswer,
              question.type,
              question.options,
            )}
          </span>
          <span className="text-cyan">
            {answeredCount}/{teams.length} answered
          </span>
          <span className="text-cyan">{correctCount} correct</span>
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {sortedTeams.map((team) => (
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
