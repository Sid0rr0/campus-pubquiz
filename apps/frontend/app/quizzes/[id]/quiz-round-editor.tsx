'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import {
  makeQuestion,
  type EditorQuestion,
  type EditorRound,
} from '@/app/quizzes/[id]/quiz-draft-state';
import { QuizQuestionEditor } from '@/app/quizzes/[id]/quiz-question-editor';

interface QuizRoundEditorProps {
  round: EditorRound;
  isFirst: boolean;
  isLast: boolean;
  /** A session is live on this quiz — round/question add/delete/reorder controls are disabled entirely. */
  isLive: boolean;
  /** `dbId`s of questions already shown/in progress in a live session. */
  lockedQuestionIds: ReadonlySet<number>;
  onChange: (patch: Partial<EditorRound>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function QuizRoundEditor({
  round,
  isFirst,
  isLast,
  isLive,
  lockedQuestionIds,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: QuizRoundEditorProps) {
  function updateQuestion(
    questionId: string,
    patch: Partial<EditorQuestion>,
  ): void {
    onChange({
      questions: round.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
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
      questions: [...round.questions, makeQuestion(crypto.randomUUID())],
    });
  }

  function moveQuestion(questionId: string, direction: -1 | 1): void {
    const index = round.questions.findIndex(
      (question) => question.id === questionId,
    );
    const targetIndex = index + direction;
    if (
      index === -1 ||
      targetIndex < 0 ||
      targetIndex >= round.questions.length
    )
      return;
    const questions = round.questions.slice();
    [questions[index], questions[targetIndex]] = [
      questions[targetIndex],
      questions[index],
    ];
    onChange({ questions });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-foreground/15 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={round.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Round title"
          className="min-w-0 flex-1 rounded-lg border-2 border-foreground/25 px-3 py-2 text-sm font-extrabold text-foreground"
        />
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
            checked={isLast || round.breakAfter}
            disabled={isLast}
            onChange={(event) => onChange({ breakAfter: event.target.checked })}
            className="h-4 w-4"
          />
          Break after
        </label>
        <label
          className="flex items-center gap-2 text-xs font-extrabold text-foreground/60"
          title="Speed-based scoring, answer then reveal, leaderboard shows only the top teams"
        >
          <input
            type="checkbox"
            checked={round.kahootMode}
            onChange={(event) => onChange({ kahootMode: event.target.checked })}
            className="h-4 w-4"
            aria-describedby={`kahoot-mode-hint-${round.id}`}
          />
          Kahoot mode
        </label>
        <span id={`kahoot-mode-hint-${round.id}`} className="sr-only">
          Speed-based scoring, answer then reveal, leaderboard shows only the
          top teams
        </span>
        <Button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst || isLive}
          variant="icon"
          size="icon-md"
          aria-label="Move round up"
        >
          <ArrowUpIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          onClick={onMoveDown}
          disabled={isLast || isLive}
          variant="icon"
          size="icon-md"
          aria-label="Move round down"
        >
          <ArrowDownIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          onClick={onDelete}
          disabled={isLive}
          variant="icon-danger"
          size="icon-md"
          aria-label="Delete round"
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {round.questions.map((question, index) => (
          <QuizQuestionEditor
            key={question.id}
            question={question}
            index={index}
            isFirst={index === 0}
            isLast={index === round.questions.length - 1}
            isLive={isLive}
            isLocked={
              question.dbId !== undefined &&
              lockedQuestionIds.has(question.dbId)
            }
            onChange={(patch) => updateQuestion(question.id, patch)}
            onDelete={() => deleteQuestion(question.id)}
            onMoveUp={() => moveQuestion(question.id, -1)}
            onMoveDown={() => moveQuestion(question.id, 1)}
          />
        ))}
      </div>

      <Button
        type="button"
        onClick={addQuestion}
        disabled={isLive}
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
