'use client';

import { makeQuestion, type EditorQuestion, type EditorRound } from '@/app/quizzes/[id]/quiz-draft-state';
import { QuizQuestionEditor } from '@/app/quizzes/[id]/quiz-question-editor';

interface QuizRoundEditorProps {
  round: EditorRound;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<EditorRound>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function QuizRoundEditor({
  round,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: QuizRoundEditorProps) {
  function updateQuestion(questionId: string, patch: Partial<EditorQuestion>): void {
    onChange({
      questions: round.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    });
  }

  function deleteQuestion(questionId: string): void {
    onChange({ questions: round.questions.filter((question) => question.id !== questionId) });
  }

  function addQuestion(): void {
    onChange({ questions: [...round.questions, makeQuestion(crypto.randomUUID())] });
  }

  function moveQuestion(questionId: string, direction: -1 | 1): void {
    const index = round.questions.findIndex((question) => question.id === questionId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= round.questions.length) return;
    const questions = round.questions.slice();
    [questions[index], questions[targetIndex]] = [questions[targetIndex], questions[index]];
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
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          <input
            type="checkbox"
            checked={round.breakAfter}
            onChange={(event) => onChange({ breakAfter: event.target.checked })}
            className="h-4 w-4"
          />
          Break after
        </label>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move round up"
          className="h-8 w-8 rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move round down"
          className="h-8 w-8 rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete round"
          className="h-8 w-8 rounded-lg border-2 border-magenta/30 font-extrabold text-magenta"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {round.questions.map((question, index) => (
          <QuizQuestionEditor
            key={question.id}
            question={question}
            index={index}
            isFirst={index === 0}
            isLast={index === round.questions.length - 1}
            onChange={(patch) => updateQuestion(question.id, patch)}
            onDelete={() => deleteQuestion(question.id)}
            onMoveUp={() => moveQuestion(question.id, -1)}
            onMoveDown={() => moveQuestion(question.id, 1)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="self-start rounded-lg border-2 border-dashed border-foreground/30 px-4 py-2 text-sm font-extrabold text-foreground"
      >
        + Add question
      </button>
    </div>
  );
}
