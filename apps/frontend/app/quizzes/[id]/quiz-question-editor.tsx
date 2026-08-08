'use client';

import { extractYoutubeVideoId, type QuestionType } from '@campus-pubquiz/types';
import { makeOption, type EditorQuestion } from '@/app/quizzes/[id]/quiz-draft-state';

interface QuizQuestionEditorProps {
  question: EditorQuestion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<EditorQuestion>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'free_text', label: 'Free text' },
  { value: 'picture', label: 'Picture' },
  { value: 'audio', label: 'Audio' },
  { value: 'youtube', label: 'YouTube video' },
];

function typeButtonClass(isActive: boolean): string {
  return isActive
    ? 'px-3 py-2 text-xs font-extrabold bg-cyan text-white'
    : 'px-3 py-2 text-xs font-extrabold bg-white text-foreground';
}

// The backend derives mediaStartSeconds/mediaEndSeconds by regexing a
// question's notes for start:/end: (see parseYoutubeClipFromNotes) — no
// dedicated schema field. This is the editor's own canonical line format for
// that convention, so the two clip inputs below can round-trip through the
// same `notes` string the Notes textarea edits. Notes written by hand in a
// looser format (or via CSV import) still work at save time; they just won't
// pre-fill these two inputs since they don't match this exact line shape.
const CLIP_LINE_PATTERN = /\n?YouTube clip: \{start: "([^"]*)", end: "([^"]*)"\}$/;

function splitClipFromNotes(notes: string): {
  freeNotes: string;
  clipStart: string;
  clipEnd: string;
} {
  const match = CLIP_LINE_PATTERN.exec(notes);
  if (!match) return { freeNotes: notes, clipStart: '', clipEnd: '' };
  return { freeNotes: notes.slice(0, match.index), clipStart: match[1], clipEnd: match[2] };
}

function composeNotesWithClip(freeNotes: string, clipStart: string, clipEnd: string): string {
  if (!clipStart && !clipEnd) return freeNotes;
  const clipLine = `YouTube clip: {start: "${clipStart}", end: "${clipEnd}"}`;
  return freeNotes ? `${freeNotes}\n${clipLine}` : clipLine;
}

export function QuizQuestionEditor({
  question,
  index,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: QuizQuestionEditorProps) {
  const isMc = question.type === 'multiple_choice';
  const needsMediaUrl =
    question.type === 'picture' || question.type === 'audio' || question.type === 'youtube';
  const isYoutubeMedia =
    question.type === 'youtube' || extractYoutubeVideoId(question.mediaUrl) !== undefined;
  const { freeNotes, clipStart, clipEnd } = isYoutubeMedia
    ? splitClipFromNotes(question.notes)
    : { freeNotes: question.notes, clipStart: '', clipEnd: '' };

  function updateClip(nextStart: string, nextEnd: string): void {
    onChange({ notes: composeNotesWithClip(freeNotes, nextStart, nextEnd) });
  }

  function updateOption(optionIndex: number, text: string): void {
    onChange({
      options: question.options.map((option, i) =>
        i === optionIndex ? { ...option, text } : option,
      ),
    });
  }

  function setCorrectOption(optionIndex: number): void {
    onChange({
      options: question.options.map((option, i) => ({
        ...option,
        isCorrect: i === optionIndex,
      })),
    });
  }

  function addOption(): void {
    onChange({ options: [...question.options, makeOption()] });
  }

  function removeOption(optionIndex: number): void {
    onChange({ options: question.options.filter((_, i) => i !== optionIndex) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-cyan text-xs font-extrabold text-white">
          {index + 1}
        </span>
        <textarea
          value={question.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          placeholder="Question prompt"
          rows={2}
          className="min-w-0 flex-1 resize-y rounded-lg border-2 border-foreground/25 px-3 py-2 text-sm font-bold text-foreground"
        />
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move question up"
          className="mt-1 h-7 w-7 shrink-0 rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move question down"
          className="mt-1 h-7 w-7 shrink-0 rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete question"
          className="mt-1 h-7 w-7 shrink-0 rounded-lg border-2 border-magenta/30 font-extrabold text-magenta"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border-2 border-foreground/20">
          {QUESTION_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ type: option.value })}
              className={typeButtonClass(question.type === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          Points
          <input
            type="number"
            value={question.points}
            onChange={(event) => onChange({ points: Number(event.target.value) || 0 })}
            className="w-16 rounded-lg border-2 border-foreground/25 px-2 py-1 text-sm font-extrabold text-foreground"
          />
        </label>
      </div>

      {isMc ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <input
                type="radio"
                checked={option.isCorrect}
                onChange={() => setCorrectOption(optionIndex)}
                aria-label={`Mark option ${optionIndex + 1} as correct`}
                className="h-4 w-4 accent-green"
              />
              <input
                value={option.text}
                onChange={(event) => updateOption(optionIndex, event.target.value)}
                placeholder="Option text"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
              />
              <button
                type="button"
                onClick={() => removeOption(optionIndex)}
                disabled={question.options.length <= 2}
                aria-label={`Remove option ${optionIndex + 1}`}
                className="h-7 w-7 shrink-0 rounded-lg border-2 border-magenta/30 font-extrabold text-magenta disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="self-start text-xs font-extrabold text-foreground/60"
          >
            + Add option
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          Correct answer
          <input
            value={question.correctText}
            onChange={(event) => onChange({ correctText: event.target.value })}
            placeholder="Accepted answer"
            className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
          />
        </label>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          Media URL{needsMediaUrl ? ' (required)' : ''}
          <input
            value={question.mediaUrl}
            onChange={(event) => onChange({ mediaUrl: event.target.value })}
            placeholder={question.type === 'youtube' ? 'https://youtu.be/…' : 'https://…'}
            className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          Answer media URL
          <input
            value={question.answerMediaUrl}
            onChange={(event) => onChange({ answerMediaUrl: event.target.value })}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
          />
        </label>
      </div>

      {isYoutubeMedia && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
            Clip start
            <input
              value={clipStart}
              onChange={(event) => updateClip(event.target.value, clipEnd)}
              placeholder="1:22"
              className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
            Clip end
            <input
              value={clipEnd}
              onChange={(event) => updateClip(clipStart, event.target.value)}
              placeholder="2:20"
              className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
            />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs font-extrabold text-foreground/60">
        Notes
        <textarea
          value={freeNotes}
          onChange={(event) => onChange({ notes: composeNotesWithClip(event.target.value, clipStart, clipEnd) })}
          rows={1}
          className="resize-y rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
        />
      </label>
    </div>
  );
}
