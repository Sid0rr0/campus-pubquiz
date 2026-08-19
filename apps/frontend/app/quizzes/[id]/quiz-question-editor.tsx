'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Cross2Icon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  extractYoutubeVideoId,
  type QuestionType,
} from '@campus-pubquiz/types';
import {
  makeMatchPair,
  makeOption,
  type EditorQuestion,
} from '@/app/quizzes/[id]/quiz-draft-state';

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
  { value: 'sort', label: 'Sort / order' },
  { value: 'match', label: 'Match pairs' },
  { value: 'closest_guess', label: 'Closest guess' },
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
const CLIP_LINE_PATTERN =
  /\n?YouTube clip: \{start: "([^"]*)", end: "([^"]*)"\}$/;

function splitClipFromNotes(notes: string): {
  freeNotes: string;
  clipStart: string;
  clipEnd: string;
} {
  const match = CLIP_LINE_PATTERN.exec(notes);
  if (!match) return { freeNotes: notes, clipStart: '', clipEnd: '' };
  return {
    freeNotes: notes.slice(0, match.index),
    clipStart: match[1],
    clipEnd: match[2],
  };
}

function composeNotesWithClip(
  freeNotes: string,
  clipStart: string,
  clipEnd: string,
): string {
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
  const isSort = question.type === 'sort';
  const isMatch = question.type === 'match';
  const needsMediaUrl =
    question.type === 'picture' ||
    question.type === 'audio' ||
    question.type === 'youtube';
  const isYoutubeMedia =
    question.type === 'youtube' ||
    extractYoutubeVideoId(question.mediaUrl) !== undefined;
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

  function updateSortItem(itemIndex: number, text: string): void {
    onChange({
      sortItems: question.sortItems.map((item, i) =>
        i === itemIndex ? text : item,
      ),
    });
  }

  function addSortItem(): void {
    onChange({ sortItems: [...question.sortItems, ''] });
  }

  function removeSortItem(itemIndex: number): void {
    onChange({
      sortItems: question.sortItems.filter((_, i) => i !== itemIndex),
    });
  }

  function moveSortItem(itemIndex: number, direction: -1 | 1): void {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= question.sortItems.length) return;
    const items = [...question.sortItems];
    [items[itemIndex], items[targetIndex]] = [
      items[targetIndex],
      items[itemIndex],
    ];
    onChange({ sortItems: items });
  }

  function updateMatchPair(
    pairIndex: number,
    side: 'left' | 'right',
    text: string,
  ): void {
    onChange({
      matchPairs: question.matchPairs.map((pair, i) =>
        i === pairIndex ? { ...pair, [side]: text } : pair,
      ),
    });
  }

  function addMatchPair(): void {
    onChange({ matchPairs: [...question.matchPairs, makeMatchPair()] });
  }

  function removeMatchPair(pairIndex: number): void {
    onChange({
      matchPairs: question.matchPairs.filter((_, i) => i !== pairIndex),
    });
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
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
        >
          <ArrowUpIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move question down"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
        >
          <ArrowDownIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete question"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-magenta/30 font-extrabold text-magenta"
        >
          <TrashIcon aria-hidden="true" />
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
            onChange={(event) =>
              onChange({ points: Number(event.target.value) || 0 })
            }
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
                onChange={(event) =>
                  updateOption(optionIndex, event.target.value)
                }
                placeholder="Option text"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
              />
              <button
                type="button"
                onClick={() => removeOption(optionIndex)}
                disabled={question.options.length <= 2}
                aria-label={`Remove option ${optionIndex + 1}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-magenta/30 font-extrabold text-magenta disabled:opacity-30"
              >
                <Cross2Icon aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 self-start text-xs font-extrabold text-foreground/60"
          >
            <PlusIcon aria-hidden="true" />
            Add option
          </button>
        </div>
      ) : isSort ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-extrabold text-foreground/60">
            Items, in the correct order (players see them shuffled)
          </p>
          {question.sortItems.map((item, itemIndex) => (
            <div key={itemIndex} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center font-display text-cyan">
                {itemIndex + 1}
              </span>
              <input
                value={item}
                onChange={(event) =>
                  updateSortItem(itemIndex, event.target.value)
                }
                placeholder="Item text"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
              />
              <button
                type="button"
                onClick={() => moveSortItem(itemIndex, -1)}
                disabled={itemIndex === 0}
                aria-label={`Move item ${itemIndex + 1} up`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
              >
                <ArrowUpIcon aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => moveSortItem(itemIndex, 1)}
                disabled={itemIndex === question.sortItems.length - 1}
                aria-label={`Move item ${itemIndex + 1} down`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
              >
                <ArrowDownIcon aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => removeSortItem(itemIndex)}
                disabled={question.sortItems.length <= 2}
                aria-label={`Remove item ${itemIndex + 1}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-magenta/30 font-extrabold text-magenta disabled:opacity-30"
              >
                <Cross2Icon aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSortItem}
            className="flex items-center gap-1 self-start text-xs font-extrabold text-foreground/60"
          >
            <PlusIcon aria-hidden="true" />
            Add item
          </button>
        </div>
      ) : isMatch ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-extrabold text-foreground/60">
            Left ↔ right pairs (players see both lists shuffled)
          </p>
          {question.matchPairs.map((pair, pairIndex) => (
            <div key={pairIndex} className="flex items-center gap-2">
              <input
                value={pair.left}
                onChange={(event) =>
                  updateMatchPair(pairIndex, 'left', event.target.value)
                }
                placeholder="Left item"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
              />
              <span aria-hidden="true" className="font-display text-cyan">
                →
              </span>
              <input
                value={pair.right}
                onChange={(event) =>
                  updateMatchPair(pairIndex, 'right', event.target.value)
                }
                placeholder="Right item"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
              />
              <button
                type="button"
                onClick={() => removeMatchPair(pairIndex)}
                disabled={question.matchPairs.length <= 2}
                aria-label={`Remove pair ${pairIndex + 1}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-magenta/30 font-extrabold text-magenta disabled:opacity-30"
              >
                <Cross2Icon aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMatchPair}
            className="flex items-center gap-1 self-start text-xs font-extrabold text-foreground/60"
          >
            <PlusIcon aria-hidden="true" />
            Add pair
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          Correct answer
          <input
            type={question.type === 'closest_guess' ? 'number' : 'text'}
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
            placeholder={
              question.type === 'youtube' ? 'https://youtu.be/…' : 'https://…'
            }
            className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
          Answer media URL
          <input
            value={question.answerMediaUrl}
            onChange={(event) =>
              onChange({ answerMediaUrl: event.target.value })
            }
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
          onChange={(event) =>
            onChange({
              notes: composeNotesWithClip(
                event.target.value,
                clipStart,
                clipEnd,
              ),
            })
          }
          rows={1}
          className="resize-y rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground"
        />
      </label>
    </div>
  );
}
