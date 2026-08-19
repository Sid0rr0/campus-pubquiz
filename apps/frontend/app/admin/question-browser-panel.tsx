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
  /** Question currently shown on `/display`, or null when nothing question-shaped is on screen. */
  displayQuestionId: number | null;
  /** 0-based round index whose title card is on `/display`, or null. */
  displayTitleRoundIndex: number | null;
  /** 0-based round index whose break card is on `/display`, or null. */
  displayBreakRoundIndex: number | null;
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
  /** IDs of current-block questions still missing a grade — drives the "not yet graded" dot. */
  ungradedQuestionIds: number[];
}

function questionButtonClasses(
  isSelected: boolean,
  isOnDisplay: boolean,
  isCompact: boolean,
): string {
  const size = isCompact ? 'h-6 min-w-6 text-[11px]' : 'h-8 min-w-8 text-sm';
  // The green ring (live on /display) is independent of the magenta border
  // (being graded) — a question can be either, both, or neither at once.
  const displayRing = isOnDisplay
    ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-background'
    : '';
  if (isSelected) {
    return `flex items-center justify-center rounded-md border-2 border-magenta bg-white font-extrabold text-magenta ${size} ${displayRing}`;
  }
  const idle = isCompact
    ? 'border border-foreground/20 text-foreground/40'
    : 'border-2 border-foreground/30';
  return `flex items-center justify-center rounded-md bg-white font-extrabold ${idle} ${size} ${displayRing}`;
}

/** Non-interactive marker for a title/break card — there's no question behind it to select for grading. */
function displayMarkerClasses(
  isOnDisplay: boolean,
  isCompact: boolean,
): string {
  const size = isCompact ? 'h-6 min-w-6 text-[10px]' : 'h-8 min-w-8 text-xs';
  const displayRing = isOnDisplay
    ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-background'
    : '';
  const idle = isCompact
    ? 'border border-dashed border-foreground/20 text-foreground/40'
    : 'border-2 border-dashed border-foreground/30 text-foreground/60';
  return `flex items-center justify-center rounded-full bg-white font-extrabold ${idle} ${size} ${displayRing}`;
}

export function QuestionBrowserPanel({
  rounds,
  currentRoundIndex,
  activeBlockStartIndex,
  selectedQuestionId,
  displayQuestionId,
  displayTitleRoundIndex,
  displayBreakRoundIndex,
  onSelectQuestion,
  liveAnswers,
  teams,
  onGrade,
  fallbackQuestions,
  ungradedQuestionIds,
}: QuestionBrowserPanelProps) {
  if (rounds.length === 0 && selectedQuestionId === null) {
    return null;
  }

  const selectedPrompt =
    rounds
      .flatMap((round) => round.questions)
      .find((question) => question.id === selectedQuestionId)?.prompt ??
    fallbackQuestions.find((question) => question.id === selectedQuestionId)
      ?.prompt;
  const hasLiveAnswers = liveAnswers?.questionId === selectedQuestionId;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg">Grade Questions</h2>
      {rounds.length > 0 && (
        <div className="flex flex-col gap-1">
          {rounds.map((round, roundIndex) => {
            const isActiveRound =
              roundIndex >= activeBlockStartIndex &&
              roundIndex <= currentRoundIndex;
            const isTitleOnDisplay = roundIndex === displayTitleRoundIndex;
            const isBreakOnDisplay = roundIndex === displayBreakRoundIndex;
            return (
              <div
                key={`${round.title}-${roundIndex}`}
                className="flex flex-wrap items-center gap-1.5"
              >
                <span>{roundIndex + 1}</span>
                <nav
                  aria-label={`${round.title} questions`}
                  className="flex flex-wrap items-center gap-1"
                >
                  <span
                    title={`${round.title} title card${isTitleOnDisplay ? ' (live on display)' : ''}`}
                    className={displayMarkerClasses(
                      isTitleOnDisplay,
                      !isActiveRound,
                    )}
                  >
                    T
                  </span>
                  {round.questions.map((question, questionIndex) => {
                    const isSelected = question.id === selectedQuestionId;
                    const isOnDisplay = question.id === displayQuestionId;
                    const isUngraded = ungradedQuestionIds.includes(
                      question.id,
                    );
                    const label = `Grade question ${questionIndex + 1} of ${round.title}${isOnDisplay ? ' (live on display)' : ''}${isUngraded ? ' (not yet graded)' : ''}`;
                    return (
                      <span key={question.id} className="relative inline-flex">
                        <button
                          type="button"
                          aria-label={label}
                          aria-pressed={isSelected}
                          onClick={() => onSelectQuestion(question.id)}
                          className={questionButtonClasses(
                            isSelected,
                            isOnDisplay,
                            !isActiveRound,
                          )}
                        >
                          {questionIndex + 1}
                        </button>
                        {isUngraded && (
                          <span
                            aria-hidden="true"
                            title="Not yet graded"
                            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-magenta ring-1 ring-white"
                          />
                        )}
                      </span>
                    );
                  })}
                  {round.breakAfter && (
                    <span
                      title={`${round.title} break card${isBreakOnDisplay ? ' (live on display)' : ''}`}
                      className={displayMarkerClasses(
                        isBreakOnDisplay,
                        !isActiveRound,
                      )}
                    >
                      B
                    </span>
                  )}
                </nav>

                <p
                  className={
                    isActiveRound
                      ? 'text-xs font-extrabold tracking-wide text-foreground/55'
                      : 'text-[10px] font-bold tracking-wide text-foreground/35'
                  }
                >
                  {round.title}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {selectedQuestionId !== null && hasLiveAnswers && liveAnswers && (
        <AnswersPanel
          liveAnswers={liveAnswers}
          teams={teams}
          onGrade={onGrade}
        />
      )}
      {selectedQuestionId !== null && !hasLiveAnswers && selectedPrompt && (
        <p className="text-sm font-bold">{selectedPrompt}</p>
      )}
    </section>
  );
}
