'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { type LiveEditFrontier } from '@campus-pubquiz/types';
import { reorderById } from '@/app/lib/reorder-list';
import {
  describeEditorRounds,
  type EditorQuestion,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { questionAnchorId } from '@/app/quizzes/[id]/quiz-question-editor';
import { roundAnchorId } from '@/app/quizzes/[id]/quiz-round-editor';

interface QuizOutlineProps {
  rounds: EditorRound[];
  /** Present while a session is live on this quiz — round dragging is disabled, and so is dragging the questions it pins in place, matching the round/question editors. */
  liveEdit?: LiveEditFrontier;
  onReorderRounds: (rounds: EditorRound[]) => void;
  onReorderQuestions: (roundId: string, questions: EditorQuestion[]) => void;
}

const PROMPT_PREVIEW_LENGTH = 42;

function questionPreview(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return 'Untitled question';
  return trimmed.length > PROMPT_PREVIEW_LENGTH
    ? `${trimmed.slice(0, PROMPT_PREVIEW_LENGTH)}…`
    : trimmed;
}

function useOutlineSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

interface OutlineQuestionRowProps {
  question: EditorQuestion;
  index: number;
  /** A live session pins this question where it is — it can't be dragged. */
  isPinned: boolean;
}

function OutlineQuestionRow({
  question,
  index,
  isPinned,
}: OutlineQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: question.id, disabled: isPinned });

  function handleJumpToQuestion(): void {
    document
      .getElementById(questionAnchorId(question.id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-1 py-1 text-xs font-bold text-foreground/70"
    >
      <button
        type="button"
        aria-label={`Drag to reorder question ${index + 1}, ${questionPreview(question.prompt)}`}
        className="flex h-5 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-foreground/30 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
        disabled={isPinned}
        {...attributes}
        {...listeners}
      >
        <DragHandleDots2Icon aria-hidden="true" />
      </button>
      <span className="shrink-0 text-foreground/40">{index + 1}.</span>
      <button
        type="button"
        onClick={handleJumpToQuestion}
        aria-label={`Jump to question ${index + 1}, ${questionPreview(question.prompt)}`}
        className="min-w-0 flex-1 truncate text-left hover:text-magenta hover:underline"
      >
        {questionPreview(question.prompt)}
      </button>
    </li>
  );
}

interface OutlineRoundRowProps {
  round: EditorRound;
  index: number;
  /** The state machine has no way to reveal answers otherwise, so the last round always breaks regardless of its own breakAfter — see quiz-draft-state.ts's toSaveRequest and QuizRoundEditor, which show the same forced state. */
  isLast: boolean;
  /** A live session has reached this round — it can't be dragged. */
  isReached: boolean;
  /** How many questions at the start of the round a live session pins in place — they can't be dragged, and nothing can be dropped among them. */
  pinnedQuestionCount: number;
  onReorderQuestions: (roundId: string, questions: EditorQuestion[]) => void;
}

function OutlineRoundRow({
  round,
  index,
  isLast,
  isReached,
  pinnedQuestionCount,
  onReorderQuestions,
}: OutlineRoundRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: round.id, disabled: isReached });
  const sensors = useOutlineSensors();

  function handleQuestionDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;
    const isDroppedAmongPinned = [active.id, over.id].some(
      (id) =>
        round.questions.findIndex((question) => question.id === id) <
        pinnedQuestionCount,
    );
    if (isDroppedAmongPinned) return;
    const reordered = reorderById(
      round.questions,
      String(active.id),
      String(over.id),
    );
    if (!reordered) return;
    onReorderQuestions(round.id, reordered);
  }

  function handleJumpToRound(): void {
    document
      .getElementById(roundAnchorId(round.id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-xl border border-foreground/15 bg-white p-2"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Drag to reorder round ${index + 1}, ${round.title.trim() || 'Untitled round'}`}
          className="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-foreground/30 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          disabled={isReached}
          {...attributes}
          {...listeners}
        >
          <DragHandleDots2Icon aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleJumpToRound}
          aria-label={`Jump to round ${index + 1}, ${round.title.trim() || 'Untitled round'}`}
          className="min-w-0 flex-1 truncate text-left font-display text-xs text-foreground hover:text-magenta hover:underline"
        >
          {index + 1}. {round.title.trim() || 'Untitled round'}
        </button>
      </div>
      {round.questions.length > 0 && (
        <DndContext
          id={`quiz-outline-questions-${round.id}`}
          sensors={sensors}
          onDragEnd={handleQuestionDragEnd}
        >
          <SortableContext
            items={round.questions.map((question) => question.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="mt-1 flex flex-col pl-4">
              {round.questions.map((question, questionIndex) => (
                <OutlineQuestionRow
                  key={question.id}
                  question={question}
                  index={questionIndex}
                  isPinned={questionIndex < pinnedQuestionCount}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {(isLast || round.breakAfter) && (
        <p className="ml-7 text-[10px] font-extrabold tracking-wide text-magenta">
          Break after this round
        </p>
      )}
    </li>
  );
}

/**
 * Bird's-eye view of the quiz next to the round/question editors — shows
 * every round's title and each question's prompt (truncated), and lets the
 * admin drag rounds to reorder the quiz or drag questions to reorder within
 * their round. Questions only reorder within their own round here, matching
 * the round editor's own up/down controls (there's no move-between-rounds
 * anywhere yet).
 */
export function QuizOutline({
  rounds,
  liveEdit,
  onReorderRounds,
  onReorderQuestions,
}: QuizOutlineProps) {
  const sensors = useOutlineSensors();
  const described = describeEditorRounds(rounds, liveEdit);

  function handleRoundDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;
    const isDroppedOnReachedRound =
      described !== undefined &&
      [active.id, over.id].some(
        (id) =>
          described[rounds.findIndex((round) => round.id === id)]?.isReached,
      );
    if (isDroppedOnReachedRound) return;
    const reordered = reorderById(rounds, String(active.id), String(over.id));
    if (!reordered) return;
    onReorderRounds(reordered);
  }

  if (rounds.length === 0) return null;

  return (
    <nav aria-label="Quiz outline" className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-foreground/15 bg-background/60 p-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/50">
          Outline
        </p>
        <DndContext
          id="quiz-outline-rounds"
          sensors={sensors}
          onDragEnd={handleRoundDragEnd}
        >
          <SortableContext
            items={rounds.map((round) => round.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-2">
              {rounds.map((round, index) => (
                <OutlineRoundRow
                  key={round.id}
                  round={round}
                  index={index}
                  isLast={index === rounds.length - 1}
                  isReached={described?.[index].isReached ?? false}
                  pinnedQuestionCount={
                    described?.[index].pinnedQuestionCount ?? 0
                  }
                  onReorderQuestions={onReorderQuestions}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </nav>
  );
}
