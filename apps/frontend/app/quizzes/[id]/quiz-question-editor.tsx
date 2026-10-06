'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Cross2Icon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  QUESTION_KINDS,
  QUESTION_TYPES,
  extractYoutubeVideoId,
  isKahootAllowedType,
  type MatchScoringMode,
  type QuestionType,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { FieldErrors, fieldIssues } from '@/app/quizzes/[id]/field-errors';
import { MediaUrlField } from '@/app/quizzes/[id]/media-url-field';
import {
  makeMatchPair,
  hasEditorChoices,
  makeOption,
  type EditorQuestion,
} from '@/app/quizzes/[id]/quiz-draft-state';

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
  const {
    inputKind,
    choices,
    requiresMedia: needsMediaUrl,
  } = QUESTION_KINDS[question.type];
  const isMc = choices !== 'none';
  const isTypedAnswer = !isMc || !hasEditorChoices(question);
  const isSort = inputKind === 'sort';
  const isMatch = inputKind === 'match';
  const hasClipNotes = 'clipNotes' in QUESTION_KINDS[question.type];
  const isYoutubeMedia =
    hasClipNotes || extractYoutubeVideoId(question.mediaUrl) !== undefined;
  const { freeNotes, clipStart, clipEnd } = isYoutubeMedia
    ? clipNotes.read(question.notes)
    : { freeNotes: question.notes, clipStart: '', clipEnd: '' };

  function updateClip(nextStart: string, nextEnd: string): void {
    onChange({ notes: clipNotes.write(freeNotes, nextStart, nextEnd) });
  }

  function normalizedOptionText(text: string): string {
    return text.trim();
  }

  function isDuplicateOption(optionIndex: number): boolean {
    const normalized = normalizedOptionText(question.options[optionIndex].text);
    if (normalized === '') return false;
    return question.options.some(
      (option, i) =>
        i !== optionIndex && normalizedOptionText(option.text) === normalized,
    );
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

  const typedAnswerField = (
    <label className="flex flex-col gap-1 text-xs font-extrabold text-foreground/60">
      <span className="flex items-center gap-2">
        Correct answer
        <input
          type={inputKind === 'number' ? 'number' : 'text'}
          value={question.correctText}
          onChange={(event) => onChange({ correctText: event.target.value })}
          placeholder="Accepted answer"
          className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
        />
      </span>
      <FieldErrors issues={fieldIssues(issues, 'answer')} />
    </label>
  );

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

      {isMc ? (
        <>
          {choices === 'optional' && isTypedAnswer && typedAnswerField}
          <div className="flex flex-col gap-2">
            {choices === 'optional' && (
              <p className="text-xs font-extrabold text-foreground/60">
                Choices (optional) — fill in at least two to let teams pick
                instead of typing
              </p>
            )}
            {question.options.map((option, optionIndex) => {
              const isDuplicate = isDuplicateOption(optionIndex);
              return (
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
                    disabled={isOpened}
                    placeholder="Option text"
                    aria-invalid={isDuplicate}
                    className={`min-w-0 flex-1 rounded-lg border-2 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50 ${
                      isDuplicate ? 'border-magenta' : 'border-foreground/20'
                    }`}
                  />
                  <Button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    disabled={isOpened || question.options.length <= 2}
                    variant="icon-danger"
                    size="icon-sm"
                    aria-label={`Remove option ${optionIndex + 1}`}
                  >
                    <Cross2Icon aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            {question.options.some((_, i) => isDuplicateOption(i)) && (
              <p className="text-xs font-extrabold text-magenta">
                Options must be unique
              </p>
            )}
            <FieldErrors issues={fieldIssues(issues, 'options')} />
            <FieldErrors issues={fieldIssues(issues, 'answer')} />
            <Button
              type="button"
              onClick={addOption}
              disabled={isOpened}
              variant="outline-dashed"
              size="xs"
              className="self-start"
            >
              <PlusIcon aria-hidden="true" />
              Add option
            </Button>
          </div>
        </>
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
                disabled={isOpened}
                placeholder="Item text"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
              />
              <Button
                type="button"
                onClick={() => moveSortItem(itemIndex, -1)}
                disabled={itemIndex === 0}
                variant="icon"
                size="icon-sm"
                aria-label={`Move item ${itemIndex + 1} up`}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                onClick={() => moveSortItem(itemIndex, 1)}
                disabled={itemIndex === question.sortItems.length - 1}
                variant="icon"
                size="icon-sm"
                aria-label={`Move item ${itemIndex + 1} down`}
              >
                <ArrowDownIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                onClick={() => removeSortItem(itemIndex)}
                disabled={isOpened || question.sortItems.length <= 2}
                variant="icon-danger"
                size="icon-sm"
                aria-label={`Remove item ${itemIndex + 1}`}
              >
                <Cross2Icon aria-hidden="true" />
              </Button>
            </div>
          ))}
          <FieldErrors issues={fieldIssues(issues, 'options')} />
          <FieldErrors issues={fieldIssues(issues, 'answer')} />
          <Button
            type="button"
            onClick={addSortItem}
            disabled={isOpened}
            variant="outline-dashed"
            size="xs"
            className="self-start"
          >
            <PlusIcon aria-hidden="true" />
            Add item
          </Button>
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
                disabled={isOpened}
                placeholder="Left item"
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
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
                className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
              />
              <Button
                type="button"
                onClick={() => removeMatchPair(pairIndex)}
                disabled={isOpened || question.matchPairs.length <= 2}
                variant="icon-danger"
                size="icon-sm"
                aria-label={`Remove pair ${pairIndex + 1}`}
              >
                <Cross2Icon aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            onClick={addMatchPair}
            disabled={isOpened}
            variant="outline-dashed"
            size="xs"
            className="self-start"
          >
            <PlusIcon aria-hidden="true" />
            Add pair
          </Button>
          <label className="flex flex-col gap-1 text-xs font-extrabold text-foreground/60">
            Scoring
            <select
              value={question.matchScoringMode}
              onChange={(event) =>
                onChange({
                  matchScoringMode: event.target.value as MatchScoringMode,
                })
              }
              disabled={isOpened}
              className="w-full rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
            >
              <option value="partial">
                Partial credit — points split evenly across correct pairs
              </option>
              <option value="all_or_nothing">
                All or nothing — full points, or half if exactly one pair is
                wrong, else zero
              </option>
            </select>
            <FieldErrors issues={fieldIssues(issues, 'matchScoringMode')} />
          </label>
          <FieldErrors issues={fieldIssues(issues, 'options')} />
          <FieldErrors issues={fieldIssues(issues, 'matchTargets')} />
          <FieldErrors issues={fieldIssues(issues, 'answer')} />
        </div>
      ) : (
        typedAnswerField
      )}

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
