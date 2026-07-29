'use client';

import type { AnswerView, AnswersUpdatedPayload, TeamView } from '@campus-pubquiz/types';

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
  maxPoints: number;
  onGrade: (answerId: number, points: number) => void;
}

function AnswerRow({ teamName, answer, maxPoints, onGrade }: AnswerRowProps) {
  const hasAnswered = answer !== null;
  const isGraded = hasAnswered && answer.gradedAt !== null;
  const options = gradeOptions(maxPoints);
  const matchesAGradeOption =
    hasAnswered && options.some((option) => option.value === answer.pointsAwarded);

  return (
    <li
      className={
        hasAnswered
          ? 'flex items-center gap-3.5 rounded-xl border border-foreground/15 bg-white px-4 py-3'
          : 'flex items-center gap-3.5 rounded-xl border border-foreground/15 bg-white px-4 py-3 opacity-40'
      }
    >
      <span className="w-40 shrink-0 font-extrabold">{teamName}</span>
      <span className="flex-1 text-[15px]">{hasAnswered ? answer.value : 'No answer yet'}</span>
      {isGraded && !matchesAGradeOption && (
        <span className="sr-only">Awarded {answer.pointsAwarded} points</span>
      )}
      <div className="flex gap-1.5">
        {options.map(({ display, ariaSuffix, value }) => {
          const isSelected = isGraded && answer.pointsAwarded === value;
          return (
            <button
              key={display}
              type="button"
              disabled={!hasAnswered || isGraded}
              aria-label={`Grade ${teamName} ${ariaSuffix}`}
              onClick={() => hasAnswered && onGrade(answer.answerId, value)}
              className={
                isSelected
                  ? 'flex h-9 min-w-11 items-center justify-center rounded-lg bg-green font-extrabold text-white'
                  : 'flex h-9 min-w-11 items-center justify-center rounded-lg border-1.5 border-foreground/30 font-extrabold disabled:opacity-40'
              }
            >
              {isSelected ? `✓ ${value}` : display}
            </button>
          );
        })}
      </div>
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

export function AnswersPanel({ liveAnswers, teams, onGrade, nav }: AnswersPanelProps) {
  const { question, answers } = liveAnswers;
  const answersByTeamId = new Map(answers.map((answer) => [answer.teamId, answer]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold tracking-wide text-foreground/55">
            Round {question.roundNumber} ({question.roundTitle}) — Q{question.questionNumberInRound}{' '}
            of {question.totalQuestionsInRound}
            {nav && ` — Grading ${nav.index + 1} of ${nav.total}`}
          </p>
          {nav && (
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous question"
                disabled={nav.index === 0}
                onClick={nav.onPrevious}
                className="flex h-10 min-w-11 items-center justify-center rounded-lg border-1.5 border-foreground/30 font-extrabold disabled:opacity-40"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next question"
                disabled={nav.index >= nav.total - 1}
                onClick={nav.onNext}
                className="flex h-10 min-w-11 items-center justify-center rounded-lg border-1.5 border-foreground/30 font-extrabold disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </div>
        <h2 className="font-display text-xl">{question.prompt}</h2>
        <p className="text-sm font-bold text-green">Correct answer: {question.correctAnswer}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {teams.map((team) => (
          <AnswerRow
            key={team.teamId}
            teamName={team.teamName}
            answer={answersByTeamId.get(team.teamId) ?? null}
            maxPoints={question.points}
            onGrade={onGrade}
          />
        ))}
      </ul>
    </section>
  );
}
