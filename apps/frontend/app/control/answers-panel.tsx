'use client';

import { motion } from 'motion/react';
import {
  clueValueFromPoints,
  formatAnswer,
  QUESTION_KINDS,
  halfPoints,
  POWER_UP_LABELS,
  type AnswerView,
  type AnswersUpdatedPayload,
  type QuestionType,
  type TeamView,
} from '@campus-pubquiz/types';
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
  switch (answer.gradingState) {
    case 'ungraded':
    case 'awaiting_batch':
      return 0;
    case 'graded':
      return 2;
  }
}

function gradeOptions(maxPoints: number, hasHalf: boolean): GradeOption[] {
  const half = halfPoints(maxPoints);
  return [
    { display: '0', ariaSuffix: '0 points', value: 0 },
    ...(hasHalf
      ? [
          {
            display: `Half (${half})`,
            ariaSuffix: 'half points',
            value: half,
          },
        ]
      : []),
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
  onGrade: (answerId: number, points: number) => void;
}

/** The clue a Clue question's answer was locked in on; nothing for any other answer. */
function ClueBadge({ clue }: { clue: number | null | undefined }) {
  return clue ? (
    <span className="shrink-0 text-xs font-extrabold text-cyan">
      Clue {clue}
    </span>
  ) : null;
}

function AnswerRow({
  teamName,
  answer,
  questionType,
  questionOptions,
  maxPoints,
  onGrade,
}: AnswerRowProps) {
  const hasAnswered = answer !== null;
  const isClueQuestion = QUESTION_KINDS[questionType].hasClues;
  // The server says when an answer is graded in one batch at the lock (such as
  // a closest_guess answer); until then there's nothing to override.
  const isAwaitingBatch =
    hasAnswered && answer.gradingState === 'awaiting_batch';

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
      {answer !== null && answer.powerUps.length > 0 && (
        <span
          data-testid="answer-power-ups"
          className="shrink-0 text-xs font-extrabold text-cyan"
        >
          {answer.powerUps
            .map((powerUp) => POWER_UP_LABELS[powerUp])
            .join(', ')}
        </span>
      )}
      <span className="flex-1 text-[15px]">
        {hasAnswered
          ? formatAnswer(answer.value, {
              type: questionType,
              options: questionOptions,
            })
          : 'No answer yet'}
      </span>
      <ClueBadge clue={answer?.clue} />
      {isAwaitingBatch ? (
        <span className="text-sm font-extrabold text-foreground/55">
          Graded when the block locks
        </span>
      ) : (
        <GradeControls
          teamName={teamName}
          answer={answer}
          maxPoints={maxPoints}
          isClueQuestion={isClueQuestion}
          onGrade={onGrade}
        />
      )}
    </motion.li>
  );
}

/** The custom amount and the grade buttons, the current grade marked. */
function GradeControls({
  teamName,
  answer,
  maxPoints,
  isClueQuestion,
  onGrade,
}: Pick<AnswerRowProps, 'teamName' | 'answer' | 'maxPoints' | 'onGrade'> & {
  isClueQuestion: boolean;
}) {
  // A Clue answer is graded right (its clue's value) or wrong, never half.
  const options = gradeOptions(
    answer?.clue ? clueValueFromPoints(maxPoints, answer.clue) : maxPoints,
    !isClueQuestion,
  );
  const gradedPoints =
    answer?.gradingState === 'graded' ? answer.pointsAwarded : null;
  const isCustomGrade =
    gradedPoints !== null &&
    !options.some((option) => option.value === gradedPoints);
  const grade = (points: number) => {
    if (answer) onGrade(answer.answerId, points);
  };
  return (
    <>
      {isCustomGrade && (
        <span className="sr-only">Awarded {gradedPoints} points</span>
      )}
      <div className="flex items-center gap-1.5">
        <CustomGradeControl
          teamName={teamName}
          currentAmount={answer?.pointsAwarded ?? 0}
          isSelected={isCustomGrade}
          isDisabled={answer === null}
          onConfirm={grade}
        />
        {options.map(({ display, ariaSuffix, value }) => (
          <GradeOptionButton
            key={display}
            label={display}
            ariaLabel={`Grade ${teamName} ${ariaSuffix}`}
            isSelected={gradedPoints === value}
            isDisabled={answer === null}
            onClick={() => grade(value)}
          />
        ))}
      </div>
    </>
  );
}

function GradeOptionButton({
  label,
  ariaLabel,
  isSelected,
  isDisabled,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={isDisabled}
      variant={isSelected ? undefined : 'outline-muted'}
      aria-label={ariaLabel}
      onClick={onClick}
      className={
        isSelected
          ? 'flex h-9 min-w-11 items-center justify-center rounded-lg bg-green px-3 font-extrabold whitespace-nowrap text-white'
          : 'flex h-9 min-w-11 items-center justify-center px-3 whitespace-nowrap'
      }
    >
      {isSelected ? `✓ ${label}` : label}
    </Button>
  );
}

interface AnswersPanelProps {
  liveAnswers: AnswersUpdatedPayload;
  teams: TeamView[];
  onGrade: (answerId: number, points: number) => void;
}

export function AnswersPanel({
  liveAnswers,
  teams,
  onGrade,
}: AnswersPanelProps) {
  const { question, answers } = liveAnswers;
  const answersByTeamId = new Map(
    answers.map((answer) => [answer.teamId, answer]),
  );
  const correctCount = countCorrectAnswers(liveAnswers);
  const answeredCount = answers.length;
  const sortedTeams = [...teams].sort(
    (a, b) =>
      gradingSortRank(answersByTeamId.get(a.teamId) ?? null) -
      gradingSortRank(answersByTeamId.get(b.teamId) ?? null),
  );

  return (
    <section className="flex flex-col gap-3">
      <p className="flex gap-5 text-sm font-bold">
        <span className="text-cyan">
          {answeredCount}/{teams.length} answered
        </span>
        <span className="text-cyan">{correctCount} correct</span>
      </p>
      <ul className="flex flex-col gap-2">
        {sortedTeams.map((team) => (
          <AnswerRow
            key={team.teamId}
            teamName={team.teamName}
            answer={answersByTeamId.get(team.teamId) ?? null}
            questionType={question.type}
            questionOptions={question.options}
            maxPoints={question.points}
            onGrade={onGrade}
          />
        ))}
      </ul>
    </section>
  );
}
