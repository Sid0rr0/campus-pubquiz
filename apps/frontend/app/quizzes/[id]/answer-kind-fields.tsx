'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Cross2Icon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  QUESTION_KINDS,
  type AnswerKind,
  type MatchScoringMode,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { resolveDraftAnswerKind } from '@/app/quizzes/[id]/answer-kind-drafts';
import { FieldErrors, fieldIssues } from '@/app/quizzes/[id]/field-errors';
import {
  makeMatchPair,
  makeOption,
  type EditorQuestion,
} from '@/app/quizzes/[id]/quiz-draft-state';

interface AnswerFieldsProps {
  question: EditorQuestion;
  /** Validation issues from the last rejected save that apply to this question. */
  issues: QuizDraftIssue[];
  /** The question is opened in a live session: its choices are fixed. */
  isOpened: boolean;
  onChange: (patch: Partial<EditorQuestion>) => void;
}

const TEXT_INPUT_CLASS =
  'min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50';

function TypedAnswerField({
  question,
  issues,
  onChange,
  inputType,
}: AnswerFieldsProps & { inputType: 'text' | 'number' }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-extrabold text-foreground/60">
      <span className="flex items-center gap-2">
        Correct answer
        <input
          type={inputType}
          value={question.correctText}
          onChange={(event) => onChange({ correctText: event.target.value })}
          placeholder="Accepted answer"
          className={TEXT_INPUT_CLASS}
        />
      </span>
      <FieldErrors issues={fieldIssues(issues, 'answer')} />
    </label>
  );
}

function normalizedOptionText(text: string): string {
  return text.trim();
}

function ChoiceList({
  question,
  issues,
  isOpened,
  onChange,
  hasOptionalChoices,
}: AnswerFieldsProps & { hasOptionalChoices: boolean }) {
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

  return (
    <div className="flex flex-col gap-2">
      {hasOptionalChoices && (
        <p className="text-xs font-extrabold text-foreground/60">
          Choices (optional) — fill in at least two to let teams pick instead of
          typing
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
              onClick={() =>
                onChange({
                  options: question.options.filter((_, i) => i !== optionIndex),
                })
              }
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
        onClick={() =>
          onChange({ options: [...question.options, makeOption()] })
        }
        disabled={isOpened}
        variant="outline-dashed"
        size="xs"
        className="self-start"
      >
        <PlusIcon aria-hidden="true" />
        Add option
      </Button>
    </div>
  );
}

/** A typed answer, plus the choices list for a type whose choices are optional (filling in two switches it to choice). */
function TypedAnswerFields(
  props: AnswerFieldsProps & { inputType: 'text' | 'number' },
) {
  const hasOptionalChoices =
    QUESTION_KINDS[props.question.type].choices === 'optional';
  return (
    <>
      <TypedAnswerField {...props} />
      {hasOptionalChoices && <ChoiceList {...props} hasOptionalChoices />}
    </>
  );
}

function TextFields(props: AnswerFieldsProps) {
  return <TypedAnswerFields {...props} inputType="text" />;
}

function NumberFields(props: AnswerFieldsProps) {
  return <TypedAnswerFields {...props} inputType="number" />;
}

function ChoiceFields(props: AnswerFieldsProps) {
  return (
    <ChoiceList
      {...props}
      hasOptionalChoices={
        QUESTION_KINDS[props.question.type].choices === 'optional'
      }
    />
  );
}

function SortFields({
  question,
  issues,
  isOpened,
  onChange,
}: AnswerFieldsProps) {
  function updateSortItem(itemIndex: number, text: string): void {
    onChange({
      sortItems: question.sortItems.map((item, i) =>
        i === itemIndex ? text : item,
      ),
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

  return (
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
            onChange={(event) => updateSortItem(itemIndex, event.target.value)}
            disabled={isOpened}
            placeholder="Item text"
            className={TEXT_INPUT_CLASS}
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
            onClick={() =>
              onChange({
                sortItems: question.sortItems.filter((_, i) => i !== itemIndex),
              })
            }
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
        onClick={() => onChange({ sortItems: [...question.sortItems, ''] })}
        disabled={isOpened}
        variant="outline-dashed"
        size="xs"
        className="self-start"
      >
        <PlusIcon aria-hidden="true" />
        Add item
      </Button>
    </div>
  );
}

function MatchFields({
  question,
  issues,
  isOpened,
  onChange,
}: AnswerFieldsProps) {
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

  return (
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
            className={TEXT_INPUT_CLASS}
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
            className={TEXT_INPUT_CLASS}
          />
          <Button
            type="button"
            onClick={() =>
              onChange({
                matchPairs: question.matchPairs.filter(
                  (_, i) => i !== pairIndex,
                ),
              })
            }
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
        onClick={() =>
          onChange({ matchPairs: [...question.matchPairs, makeMatchPair()] })
        }
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
            All or nothing — full points, or half if exactly one pair is wrong,
            else zero
          </option>
        </select>
        <FieldErrors issues={fieldIssues(issues, 'matchScoringMode')} />
      </label>
      <FieldErrors issues={fieldIssues(issues, 'options')} />
      <FieldErrors issues={fieldIssues(issues, 'matchTargets')} />
      <FieldErrors issues={fieldIssues(issues, 'answer')} />
    </div>
  );
}

/** One entry per answer kind; a kind without one is a compile error. */
const ANSWER_KIND_FIELDS = {
  text: TextFields,
  number: NumberFields,
  choice: ChoiceFields,
  sort: SortFields,
  match: MatchFields,
} satisfies {
  readonly [K in AnswerKind]: (props: AnswerFieldsProps) => unknown;
};

/** The answer fields for the question's answer kind, resolved from its type and the choices typed so far. */
export function AnswerSection(props: AnswerFieldsProps) {
  const Fields = ANSWER_KIND_FIELDS[resolveDraftAnswerKind(props.question)];
  return <Fields {...props} />;
}
