'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  ROUND_CATEGORIES,
  ROUND_NOTE_MAX_LENGTH,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { FieldErrors, fieldIssues } from '@/app/quizzes/[id]/field-errors';
import {
  makeQuestion,
  patchQuestion,
  type EditorQuestion,
  type EditorRound,
  type MoveTargetRound,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { QuizQuestionEditor } from '@/app/quizzes/[id]/quiz-question-editor';

/** DOM id for the round's card, so the outline can scroll it into view — see quiz-outline.tsx's jump-to-round button. */
export function roundAnchorId(roundId: string): string {
  return `round-${roundId}`;
}

interface QuizRoundEditorProps {
  round: EditorRound;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** The quiz is a quickfire quiz: no break-after toggle, and new questions default to 1000 points. */
  isQuickfire: boolean;
  /** A live session has reached this round (it is the current round or an earlier one) — it keeps its place and break-after setting, and can't be deleted. */
  isReached: boolean;
  /** The round above is reached, so this one can't move up past it. */
  isPreviousReached: boolean;
  /** A live session's block in this round is locking, or it is past it — nothing can be added to the round. */
  isStructureFrozen: boolean;
  /** How many questions at the start of the round a live session pins in place — opened ones, or all of them once frozen. */
  pinnedQuestionCount: number;
  /** Why the round's questions are restricted while a session is live, or undefined when they aren't. */
  structureNote?: string;
  /** The other rounds a question here could move to. */
  moveTargetRounds: MoveTargetRound[];
  /** `dbId`s of questions opened in a live session. */
  openedQuestionIds: ReadonlySet<number>;
  /** Validation issues from the last rejected save that apply to this round (round-level and per-question). */
  issues: QuizDraftIssue[];
  onChange: (patch: Partial<EditorRound>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveQuestionToRound: (questionId: string, roundId: string) => void;
  /** Opens the quiz preview at the question with this index in the round; absent for a quiz that was never saved, which has no preview. */
  onPreviewQuestion?: (questionIndex: number) => void;
}

export function QuizRoundEditor({
  round,
  index,
  isFirst,
  isLast,
  isQuickfire,
  isReached,
  isPreviousReached,
  isStructureFrozen,
  pinnedQuestionCount,
  structureNote,
  moveTargetRounds,
  openedQuestionIds,
  issues,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveQuestionToRound,
  onPreviewQuestion,
}: QuizRoundEditorProps) {
  const roundLevelIssues = issues.filter(
    (issue) => issue.questionIndex === null,
  );
  function updateQuestion(
    questionId: string,
    patch: Partial<EditorQuestion>,
  ): void {
    onChange({
      questions: round.questions.map((question) =>
        question.id === questionId ? patchQuestion(question, patch) : question,
      ),
    });
  }

  function deleteQuestion(questionId: string): void {
    onChange({
      questions: round.questions.filter(
        (question) => question.id !== questionId,
      ),
    });
  }

  function addQuestion(): void {
    onChange({
      questions: [
        ...round.questions,
        makeQuestion(crypto.randomUUID(), isQuickfire),
      ],
    });
  }

  function moveQuestion(questionId: string, direction: -1 | 1): void {
    const questions = swapQuestion(round.questions, questionId, direction);
    if (questions) onChange({ questions });
  }

  return (
    <div
      id={roundAnchorId(round.id)}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-foreground/15 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 rounded-full bg-foreground/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-foreground/60">
          Round {index + 1}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            value={round.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Round title"
            className="w-full rounded-lg border-2 border-foreground/25 px-3 py-2 text-sm font-extrabold text-foreground"
          />
          <FieldErrors issues={fieldIssues(roundLevelIssues, 'title')} />
        </div>
        {!isQuickfire && (
          <BreakAfterToggle
            isLast={isLast}
            isReached={isReached}
            breakAfter={round.breakAfter}
            onChange={(breakAfter) => onChange({ breakAfter })}
          />
        )}
        <Button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst || isReached || isPreviousReached}
          variant="icon"
          size="icon-md"
          aria-label="Move round up"
        >
          <ArrowUpIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          onClick={onMoveDown}
          disabled={isLast || isReached}
          variant="icon"
          size="icon-md"
          aria-label="Move round down"
        >
          <ArrowDownIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          onClick={onDelete}
          disabled={isReached}
          variant="icon-danger"
          size="icon-md"
          aria-label="Delete round"
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <select
            value={round.category}
            onChange={(event) => onChange({ category: event.target.value })}
            aria-label="Category"
            className="w-full rounded-lg border-2 border-foreground/15 px-3 py-2 text-sm font-bold text-foreground"
          >
            <option value="">Category (optional)</option>
            {ROUND_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <FieldErrors issues={fieldIssues(roundLevelIssues, 'category')} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            value={round.author}
            onChange={(event) => onChange({ author: event.target.value })}
            placeholder="Author (optional)"
            className="w-full rounded-lg border-2 border-foreground/15 px-3 py-2 text-sm font-bold text-foreground"
          />
          <FieldErrors issues={fieldIssues(roundLevelIssues, 'author')} />
        </div>
      </div>

      <RoundNoteField
        round={round}
        issues={roundLevelIssues}
        onChange={onChange}
      />

      {structureNote && (
        <p className="rounded-lg bg-cyan/20 px-3 py-2 text-xs font-extrabold text-foreground">
          {structureNote}
        </p>
      )}
      <FieldErrors issues={fieldIssues(roundLevelIssues, 'questions')} />

      <RoundQuestions
        round={round}
        isQuickfire={isQuickfire}
        pinnedQuestionCount={pinnedQuestionCount}
        moveTargetRounds={moveTargetRounds}
        openedQuestionIds={openedQuestionIds}
        issues={issues}
        onUpdate={updateQuestion}
        onDelete={deleteQuestion}
        onMove={moveQuestion}
        onPreviewQuestion={onPreviewQuestion}
        onMoveQuestionToRound={onMoveQuestionToRound}
      />

      <Button
        type="button"
        onClick={addQuestion}
        disabled={isStructureFrozen}
        variant="outline-dashed"
        size="xs"
        className="self-start"
      >
        <PlusIcon aria-hidden="true" />
        Add question
      </Button>
    </div>
  );
}

/** The questions with the one at `questionId` swapped one place up or down; null when it can't move that way. */
function swapQuestion<Question extends { id: string }>(
  questions: readonly Question[],
  questionId: string,
  direction: -1 | 1,
): Question[] | null {
  const index = questions.findIndex((question) => question.id === questionId);
  const targetIndex = index + direction;
  if (index === -1 || targetIndex < 0 || targetIndex >= questions.length) {
    return null;
  }
  const swapped = questions.slice();
  [swapped[index], swapped[targetIndex]] = [
    swapped[targetIndex],
    swapped[index],
  ];
  return swapped;
}

function RoundNoteField({
  round,
  issues,
  onChange,
}: Pick<QuizRoundEditorProps, 'round' | 'issues' | 'onChange'>) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={round.note}
        onChange={(event) => onChange({ note: event.target.value })}
        aria-label="Round note — what you say before this round"
        placeholder="Round note — what you say before this round (optional)"
        rows={2}
        className="w-full rounded-lg border-2 border-foreground/15 px-3 py-2 text-sm font-bold text-foreground"
      />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          <input
            type="checkbox"
            checked={round.showNoteOnScreen}
            disabled={!round.note.trim()}
            onChange={(event) =>
              onChange({ showNoteOnScreen: event.target.checked })
            }
            className="h-4 w-4"
          />
          Show on screen
        </label>
        <span className="text-xs font-bold text-foreground/60">
          {round.note.trim().length} / {ROUND_NOTE_MAX_LENGTH}
        </span>
      </div>
      <FieldErrors issues={fieldIssues(issues, 'note')} />
    </div>
  );
}

function RoundQuestions({
  round,
  isQuickfire,
  pinnedQuestionCount,
  moveTargetRounds,
  openedQuestionIds,
  issues,
  onUpdate,
  onDelete,
  onMove,
  onPreviewQuestion,
  onMoveQuestionToRound,
}: Pick<
  QuizRoundEditorProps,
  | 'round'
  | 'pinnedQuestionCount'
  | 'moveTargetRounds'
  | 'openedQuestionIds'
  | 'issues'
  | 'onPreviewQuestion'
  | 'onMoveQuestionToRound'
  | 'isQuickfire'
> & {
  onUpdate: (questionId: string, patch: Partial<EditorQuestion>) => void;
  onDelete: (questionId: string) => void;
  onMove: (questionId: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {round.questions.map((question, index) => (
        <QuizQuestionEditor
          key={question.id}
          question={question}
          index={index}
          isFirstMovable={index <= pinnedQuestionCount}
          isLast={index === round.questions.length - 1}
          isPinned={index < pinnedQuestionCount}
          moveTargets={moveTargetRounds.map(({ id, label }) => ({
            roundId: id,
            label,
          }))}
          isQuickfireRound={isQuickfire}
          isOpened={
            question.dbId !== undefined && openedQuestionIds.has(question.dbId)
          }
          issues={issues.filter((issue) => issue.questionIndex === index)}
          onChange={(patch) => onUpdate(question.id, patch)}
          onDelete={() => onDelete(question.id)}
          onMoveUp={() => onMove(question.id, -1)}
          onMoveDown={() => onMove(question.id, 1)}
          onPreviewFromHere={
            onPreviewQuestion && (() => onPreviewQuestion(index))
          }
          onMoveToRound={(roundId) =>
            onMoveQuestionToRound(question.id, roundId)
          }
        />
      ))}
    </div>
  );
}

/** The last round always breaks; a round a live session has reached keeps its setting. */
function BreakAfterToggle({
  isLast,
  isReached,
  breakAfter,
  onChange,
}: {
  isLast: boolean;
  isReached: boolean;
  breakAfter: boolean;
  onChange: (breakAfter: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-2 text-xs font-extrabold text-foreground/60"
      title={
        isLast
          ? 'The last round always breaks so answers can be revealed'
          : undefined
      }
    >
      <input
        type="checkbox"
        checked={isLast || breakAfter}
        disabled={isLast || isReached}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      Break after
    </label>
  );
}
