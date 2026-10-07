'use client';

import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from '@radix-ui/react-icons';
import {
  QUESTION_KINDS,
  QUESTION_TYPES,
  extractYoutubeVideoId,
  isKahootAllowedType,
  type QuestionType,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { FieldErrors, fieldIssues } from '@/app/quizzes/[id]/field-errors';
import { MediaUrlField } from '@/app/quizzes/[id]/media-url-field';
import { AnswerSection } from '@/app/quizzes/[id]/answer-kind-fields';
import { type EditorQuestion } from '@/app/quizzes/[id]/quiz-draft-state';

/** DOM id for the question's card, so the outline can scroll it into view — see quiz-outline.tsx's jump-to-question button. */
export function questionAnchorId(questionId: string): string {
  return `question-${questionId}`;
}

interface QuizQuestionEditorProps {
  question: EditorQuestion;
  index: number;
  /** Nothing movable sits above this question — the first one, or the one right after the opened questions a live session pins at the round's start. */
  isFirstMovable: boolean;
  isLast: boolean;
  /** A live session pins this question where it is (it is opened, or its block is locking) — moving, deleting and sending it to another round are disabled. */
  isPinned: boolean;
  /** Rounds this question could move to, already narrowed to those it may enter — the mover is hidden when empty. */
  moveTargets: MoveTarget[];
  /** This specific question is opened in a live session — its type and choices (what teams answered against) are disabled; prompt/answer/points/media/notes stay editable (see live-edit-guard.ts). */
  isOpened: boolean;
  /** The question's round is in kahoot mode, so the type picker offers only the kahoot-allowed types (Scoring's list). */
  isKahootRound: boolean;
  /** Validation issues from the last rejected save that apply to this question, shown next to the field each one names. */
  issues: QuizDraftIssue[];
  onChange: (patch: Partial<EditorQuestion>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToRound: (roundId: string) => void;
}

export interface MoveTarget {
  roundId: string;
  label: string;
}

/** Fields rendered with their own inline `FieldErrors` below — anything else lands in the catch-all at the bottom of the card so an issue never goes unseen. */
const PLACED_ISSUE_FIELDS = new Set([
  'prompt',
  'points',
  'answer',
  'options',
  'matchTargets',
  'matchScoringMode',
  'mediaUrl',
  'answerMediaUrl',
  'type',
]);

const QUESTION_TYPE_OPTIONS = QUESTION_TYPES.map((value) => ({
  value,
  label: QUESTION_KINDS[value].label,
}));

function typeButtonClass(isActive: boolean): string {
  return isActive
    ? 'px-3 py-2 text-xs font-extrabold bg-cyan text-white'
    : 'px-3 py-2 text-xs font-extrabold bg-white text-foreground';
}

// A clip lives in the question's notes, in the youtube kind's line format
// (parseYoutubeClipFromNotes reads it at save time) — no dedicated field.
const { clipNotes } = QUESTION_KINDS.youtube;

/** The types this question's picker offers: all of them, or in a kahoot round only the kahoot-allowed ones — plus the question's current type, so a disallowed one that arrived with a loaded quiz stays visible (and is flagged by save validation) instead of vanishing. */
function pickerTypes(
  isKahootRound: boolean,
  currentType: QuestionType,
): { value: QuestionType; label: string }[] {
  if (!isKahootRound) return QUESTION_TYPE_OPTIONS;
  return QUESTION_TYPE_OPTIONS.filter(
    (option) =>
      isKahootAllowedType(option.value) || option.value === currentType,
  );
}

export function QuizQuestionEditor({
  question,
  index,
  isFirstMovable,
  isLast,
  isPinned,
  moveTargets,
  isOpened,
  isKahootRound,
  issues,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToRound,
}: QuizQuestionEditorProps) {
  const otherIssues = issues.filter(
    (issue) => !PLACED_ISSUE_FIELDS.has(issue.field),
  );
  const { requiresMedia: needsMediaUrl } = QUESTION_KINDS[question.type];
  const hasClipNotes = 'clipNotes' in QUESTION_KINDS[question.type];
  const isYoutubeMedia =
    hasClipNotes || extractYoutubeVideoId(question.mediaUrl) !== undefined;
  const { freeNotes, clipStart, clipEnd } = isYoutubeMedia
    ? clipNotes.read(question.notes)
    : { freeNotes: question.notes, clipStart: '', clipEnd: '' };

  function updateClip(nextStart: string, nextEnd: string): void {
    onChange({ notes: clipNotes.write(freeNotes, nextStart, nextEnd) });
  }

  return (
    <div
      id={questionAnchorId(question.id)}
      className="scroll-mt-28 flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-cyan text-xs font-extrabold text-white">
          {index + 1}
        </span>
        <textarea
          value={question.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          placeholder="Question prompt"
          rows={2}
          className="min-w-0 flex-1 resize-y rounded-lg border-2 border-foreground/25 px-3 py-2 text-sm font-bold text-foreground disabled:opacity-50"
        />
        <Button
          type="button"
          onClick={onMoveUp}
          disabled={isFirstMovable || isPinned}
          variant="icon"
          size="icon-sm"
          aria-label="Move question up"
          className="mt-1"
        >
          <ArrowUpIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          onClick={onMoveDown}
          disabled={isLast || isPinned}
          variant="icon"
          size="icon-sm"
          aria-label="Move question down"
          className="mt-1"
        >
          <ArrowDownIcon aria-hidden="true" />
        </Button>
        {moveTargets.length > 0 && (
          <select
            value=""
            onChange={(event) => onMoveToRound(event.target.value)}
            disabled={isPinned}
            aria-label="Move question to round"
            className="mt-1 h-8 max-w-32 rounded-lg border-2 border-foreground/15 px-2 text-xs font-bold text-foreground disabled:opacity-50"
          >
            <option value="" disabled>
              Move to…
            </option>
            {moveTargets.map((target) => (
              <option key={target.roundId} value={target.roundId}>
                {target.label}
              </option>
            ))}
          </select>
        )}
        <Button
          type="button"
          onClick={onDelete}
          disabled={isPinned}
          variant="icon-danger"
          size="icon-sm"
          aria-label="Delete question"
          className="mt-1"
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      </div>
      <FieldErrors issues={fieldIssues(issues, 'prompt')} />

      {isOpened && (
        <p className="text-xs font-extrabold text-magenta">
          Opened — its type and choices are fixed; changing the answer or points
          re-scores auto-graded answers
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border-2 border-foreground/20">
          {pickerTypes(isKahootRound, question.type).map((option) => (
            <Button
              key={option.value}
              type="button"
              onClick={() => onChange({ type: option.value })}
              disabled={isOpened}
              className={typeButtonClass(question.type === option.value)}
            >
              {option.label}
            </Button>
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
            className="w-16 rounded-lg border-2 border-foreground/25 px-2 py-1 text-sm font-extrabold text-foreground disabled:opacity-50"
          />
        </label>
      </div>
      <FieldErrors issues={fieldIssues(issues, 'type')} />
      <FieldErrors issues={fieldIssues(issues, 'points')} />

      <AnswerSection
        question={question}
        issues={issues}
        isOpened={isOpened}
        onChange={onChange}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <MediaUrlField
            label="Media URL"
            isRequired={needsMediaUrl}
            value={question.mediaUrl}
            onChange={(mediaUrl) => onChange({ mediaUrl })}
            placeholder={hasClipNotes ? 'https://youtu.be/…' : 'https://…'}
          />
          <FieldErrors issues={fieldIssues(issues, 'mediaUrl')} />
        </div>
        <div className="flex flex-col gap-1">
          <MediaUrlField
            label="Answer media URL"
            value={question.answerMediaUrl}
            onChange={(answerMediaUrl) => onChange({ answerMediaUrl })}
            placeholder="https://…"
          />
          <FieldErrors issues={fieldIssues(issues, 'answerMediaUrl')} />
        </div>
      </div>

      {isYoutubeMedia && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
            Clip start
            <input
              value={clipStart}
              onChange={(event) => updateClip(event.target.value, clipEnd)}
              placeholder="1:22"
              className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-extrabold text-foreground/60">
            Clip end
            <input
              value={clipEnd}
              onChange={(event) => updateClip(clipStart, event.target.value)}
              placeholder="2:20"
              className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
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
              notes: clipNotes.write(event.target.value, clipStart, clipEnd),
            })
          }
          rows={1}
          className="resize-y rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
        />
      </label>
      <FieldErrors issues={otherIssues} />
    </div>
  );
}
