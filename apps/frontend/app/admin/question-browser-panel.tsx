'use client';

import type {
  AnswersUpdatedPayload,
  QuestionView,
  QuizSummaryRound,
  TeamView,
} from '@campus-pubquiz/types';
import { AnswersPanel } from '@/app/admin/answers-panel';

interface QuestionBrowserPanelProps {
  rounds: QuizSummaryRound[];
  /** 0-based index of the round currently in play (`progress.roundIndex`). */
  currentRoundIndex: number;
  /** First round of the block currently in play — rounds before it are already locked and graded. */
  activeBlockStartIndex: number;
  selectedQuestionId: number | null;
  onSelectQuestion: (questionId: number) => void;
  liveAnswers: AnswersUpdatedPayload | null;
  teams: TeamView[];
  onGrade: (answerId: number, points: number) => void;
  /**
   * Questions from the live snapshot (current + just-locked block) — a
   * prompt source for the loading gap before the round list or the
   * ANSWERS_UPDATED roundtrip has arrived.
   */
  fallbackQuestions: QuestionView[];
}

function questionButtonClasses(isSelected: boolean, isCompact: boolean): string {
  const size = isCompact ? 'h-6 min-w-6 text-[11px]' : 'h-8 min-w-8 text-sm';
  if (isSelected) {
    return `flex items-center justify-center rounded-md border-2 border-magenta bg-white font-extrabold text-magenta ${size}`;
  }
  const idle = isCompact
    ? 'border border-foreground/20 text-foreground/40'
    : 'border-2 border-foreground/30';
  return `flex items-center justify-center rounded-md bg-white font-extrabold ${idle} ${size}`;
}

export function QuestionBrowserPanel({
  rounds,
  currentRoundIndex,
  activeBlockStartIndex,
  selectedQuestionId,
  onSelectQuestion,
  liveAnswers,
  teams,
  onGrade,
  fallbackQuestions,
}: QuestionBrowserPanelProps) {
  if (rounds.length === 0 && selectedQuestionId === null) {
    return null;
  }

  const selectedPrompt =
    rounds.flatMap((round) => round.questions).find((question) => question.id === selectedQuestionId)
      ?.prompt ?? fallbackQuestions.find((question) => question.id === selectedQuestionId)?.prompt;
  const hasLiveAnswers = liveAnswers?.questionId === selectedQuestionId;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg">Grade Questions</h2>
      {rounds.length > 0 && (
        <div className="flex flex-col gap-1">
          {rounds.map((round, roundIndex) => {
            const isActiveRound =
              roundIndex >= activeBlockStartIndex && roundIndex <= currentRoundIndex;
            return (
              <div key={`${round.title}-${roundIndex}`} className="flex flex-wrap items-center gap-1.5">
                <p
                  className={
                    isActiveRound
                      ? 'text-xs font-extrabold tracking-wide text-foreground/55'
                      : 'text-[10px] font-bold tracking-wide text-foreground/35'
                  }
                >
                  {round.title}
                </p>
                <nav aria-label={`${round.title} questions`} className="flex flex-wrap gap-1">
                  {round.questions.map((question, questionIndex) => {
                    const isSelected = question.id === selectedQuestionId;
                    return (
                      <button
                        key={question.id}
                        type="button"
                        aria-label={`Grade question ${questionIndex + 1} of ${round.title}`}
                        aria-pressed={isSelected}
                        onClick={() => onSelectQuestion(question.id)}
                        className={questionButtonClasses(isSelected, !isActiveRound)}
                      >
                        {questionIndex + 1}
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>
      )}
      {selectedQuestionId !== null && hasLiveAnswers && liveAnswers && (
        <AnswersPanel liveAnswers={liveAnswers} teams={teams} onGrade={onGrade} />
      )}
      {selectedQuestionId !== null && !hasLiveAnswers && selectedPrompt && (
        <p className="text-sm font-bold">{selectedPrompt}</p>
      )}
    </section>
  );
}
