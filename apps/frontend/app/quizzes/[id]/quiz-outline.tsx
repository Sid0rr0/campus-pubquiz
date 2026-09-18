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
import { reorderById } from '@/app/lib/reorder-list';
import type {
  EditorQuestion,
  EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';

interface QuizOutlineProps {
  rounds: EditorRound[];
  /** A session is live on this quiz — dragging is disabled, matching the round/question editors above. */
  isLive: boolean;
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
  isLive: boolean;
}

function OutlineQuestionRow({
  question,
  index,
  isLive,
}: OutlineQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: question.id, disabled: isLive });

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
        disabled={isLive}
        {...attributes}
        {...listeners}
      >
        <DragHandleDots2Icon aria-hidden="true" />
      </button>
      <span className="shrink-0 text-foreground/40">{index + 1}.</span>
      <span className="truncate">{questionPreview(question.prompt)}</span>
    </li>
  );
}

interface OutlineRoundRowProps {
  round: EditorRound;
  index: number;
  /** The state machine has no way to reveal answers otherwise, so the last round always breaks regardless of its own breakAfter — see quiz-draft-state.ts's toSaveRequest and QuizRoundEditor, which show the same forced state. */
  isLast: boolean;
  isLive: boolean;
  onReorderQuestions: (roundId: string, questions: EditorQuestion[]) => void;
}

function OutlineRoundRow({
  round,
  index,
  isLast,
  isLive,
  onReorderQuestions,
}: OutlineRoundRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: round.id, disabled: isLive });
  const sensors = useOutlineSensors();

  function handleQuestionDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;
    const reordered = reorderById(
      round.questions,
      String(active.id),
      String(over.id),
    );
    if (!reordered) return;
    onReorderQuestions(round.id, reordered);
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
          disabled={isLive}
          {...attributes}
          {...listeners}
        >
          <DragHandleDots2Icon aria-hidden="true" />
        </button>
        <span className="truncate font-display text-xs text-foreground">
          {index + 1}. {round.title.trim() || 'Untitled round'}
        </span>
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
                  isLive={isLive}
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
  isLive,
  onReorderRounds,
  onReorderQuestions,
}: QuizOutlineProps) {
  const sensors = useOutlineSensors();

  function handleRoundDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;
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
                  isLive={isLive}
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
