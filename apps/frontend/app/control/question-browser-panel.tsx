'use client';

import type { AdminIndicators, QuizSummaryRound } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { isSameItem, type DetailItem } from '@/app/control/detail-item';

interface QuestionBrowserPanelProps {
  rounds: QuizSummaryRound[];
  /** 0-based index of the round currently in play (`progress.roundIndex`). */
  currentRoundIndex: number;
  /** First round of the block currently in play — rounds before it are already locked and graded. */
  activeBlockStartIndex: number;
  /** The item the detail column shows. */
  selected: DetailItem | null;
  /** What the admin view marks as on air: the question, title card and break indicator. */
  indicators: AdminIndicators;
  onSelect: (item: DetailItem) => void;
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

/** Marker button for a title/break card; selecting it shows the card in the detail column. */
function displayMarkerClasses(
  isOnDisplay: boolean,
  isCompact: boolean,
  isSelected: boolean,
): string {
  const size = isCompact ? 'h-6 min-w-6 text-[10px]' : 'h-8 min-w-8 text-xs';
  const displayRing = isOnDisplay
    ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-background'
    : '';
  if (isSelected) {
    return `flex items-center justify-center rounded-full border-2 border-magenta bg-white font-extrabold text-magenta ${size} ${displayRing}`;
  }
  const idle = isCompact
    ? 'border border-dashed border-foreground/20 text-foreground/40'
    : 'border-2 border-dashed border-foreground/30 text-foreground/60';
  return `flex items-center justify-center rounded-full bg-white font-extrabold ${idle} ${size} ${displayRing}`;
}

export function QuestionBrowserPanel({
  rounds,
  currentRoundIndex,
  activeBlockStartIndex,
  selected,
  indicators,
  onSelect,
  ungradedQuestionIds,
}: QuestionBrowserPanelProps) {
  if (rounds.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg">Grade Questions</h2>
      {rounds.length > 0 && (
        <div className="flex flex-col gap-1">
          {rounds.map((round, roundIndex) => {
            const isActiveRound =
              roundIndex >= activeBlockStartIndex &&
              roundIndex <= currentRoundIndex;
            const isTitleOnDisplay =
              roundIndex === indicators.titleCardRoundIndex;
            const isBreakOnDisplay = roundIndex === indicators.breakRoundIndex;
            const titleItem: DetailItem = { kind: 'title', roundIndex };
            const breakItem: DetailItem = { kind: 'break', roundIndex };
            return (
              <div
                key={`${round.title}-${roundIndex}`}
                className="flex flex-col gap-0.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span role="img" aria-label={`Round ${roundIndex + 1}`}>
                    {roundIndex + 1}
                  </span>
                  <nav
                    aria-label={`${round.title} questions`}
                    className="flex flex-wrap items-center gap-1"
                  >
                    <Button
                      type="button"
                      aria-label={`Show title card of ${round.title}${isTitleOnDisplay ? ' (live on display)' : ''}`}
                      aria-pressed={isSameItem(selected, titleItem)}
                      onClick={() => onSelect(titleItem)}
                      className={displayMarkerClasses(
                        isTitleOnDisplay,
                        !isActiveRound,
                        isSameItem(selected, titleItem),
                      )}
                    >
                      T
                    </Button>
                    {round.questions.map((question, questionIndex) => {
                      const isSelected =
                        selected?.kind === 'question' &&
                        question.id === selected.questionId;
                      const isOnDisplay =
                        question.id === indicators.onDisplayQuestionId;
                      const isUngraded = ungradedQuestionIds.includes(
                        question.id,
                      );
                      const label = `Grade question ${questionIndex + 1} of ${round.title}${isOnDisplay ? ' (live on display)' : ''}${isUngraded ? ' (not yet graded)' : ''}`;
                      return (
                        <span
                          key={question.id}
                          className="relative inline-flex"
                        >
                          <Button
                            type="button"
                            aria-label={label}
                            aria-pressed={isSelected}
                            onClick={() =>
                              onSelect({
                                kind: 'question',
                                questionId: question.id,
                              })
                            }
                            className={questionButtonClasses(
                              isSelected,
                              isOnDisplay,
                              !isActiveRound,
                            )}
                          >
                            {questionIndex + 1}
                          </Button>
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
                    {round.breakNumber !== undefined && (
                      <Button
                        type="button"
                        aria-label={`Show break after ${round.title}${isBreakOnDisplay ? ' (live on display)' : ''}`}
                        aria-pressed={isSameItem(selected, breakItem)}
                        onClick={() => onSelect(breakItem)}
                        className={displayMarkerClasses(
                          isBreakOnDisplay,
                          !isActiveRound,
                          isSameItem(selected, breakItem),
                        )}
                      >
                        B
                      </Button>
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
