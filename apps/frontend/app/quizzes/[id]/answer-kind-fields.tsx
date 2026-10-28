'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Cross2Icon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  DEFAULT_MARGIN,
  gradingSettingsOf,
  OPENED_QUESTION_FIXED_FIELDS,
  isScoringModeOf,
  scoringModesOf,
  SCORING_MODE_LABELS,
  hasMarginType,
  type AnswerKind,
  formatMarginHint,
  parseFiniteNumber,
  resolveAnswerKind,
  type Margin,
  type MarginUnit,
  type ScoringMode,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
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

/** A control is disabled when the saved field it writes is on the opened-question fixed list; a control writing several fields passes them all. */
export function isFixedOnOpened(
  isOpened: boolean,
  ...written: (typeof OPENED_QUESTION_FIXED_FIELDS)[number][]
): boolean {
  return (
    isOpened &&
    written.some((field) => OPENED_QUESTION_FIXED_FIELDS.includes(field))
  );
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
}: AnswerFieldsProps) {
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
              disabled={isFixedOnOpened(isOpened, 'options')}
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
              disabled={
                isFixedOnOpened(isOpened, 'options') ||
                question.options.length <= 2
              }
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
        disabled={isFixedOnOpened(isOpened, 'options')}
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

function TextFields(props: AnswerFieldsProps) {
  return <TypedAnswerField {...props} inputType="text" />;
}

const MARGIN_UNIT_LABELS: readonly { unit: MarginUnit; label: string }[] = [
  { unit: 'percent', label: '%' },
  { unit: 'absolute', label: 'absolute' },
];

function marginUnitButtonClass(isActive: boolean): string {
  return isActive
    ? 'px-3 py-1.5 text-xs font-extrabold bg-cyan text-white'
    : 'px-3 py-1.5 text-xs font-extrabold bg-white text-foreground';
}

/** Number questions only: how far an answer may be from the key and still be correct. Editable on an opened question too — changing it re-scores the answers. */
function MarginRow({ question, issues, onChange }: AnswerFieldsProps) {
  const isZeroKeyWithPercent =
    question.marginUnit === 'percent' &&
    parseFiniteNumber(question.correctText) === 0;
  const marginValue = parseFiniteNumber(question.marginValue);
  const margin: Margin | null =
    marginValue !== null && marginValue >= 0
      ? { value: marginValue, unit: question.marginUnit }
      : null;
  // With no usable margin, a non-numeric answer still gets the "enter the answer" prompt (the margin passed is irrelevant to it).
  const hintMargin =
    margin ??
    (parseFiniteNumber(question.correctText) === null ? DEFAULT_MARGIN : null);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-foreground/60">
        <label className="flex items-center gap-2">
          Margin
          <input
            type="number"
            min={0}
            step="any"
            value={question.marginValue}
            onChange={(event) => onChange({ marginValue: event.target.value })}
            className="w-20 rounded-lg border-2 border-foreground/20 px-2 py-1 text-sm font-bold text-foreground"
          />
        </label>
        <div className="flex overflow-hidden rounded-lg border-2 border-foreground/20">
          {MARGIN_UNIT_LABELS.map(({ unit, label }) => (
            <Button
              key={unit}
              type="button"
              aria-pressed={question.marginUnit === unit}
              onClick={() => onChange({ marginUnit: unit })}
              className={marginUnitButtonClass(question.marginUnit === unit)}
            >
              {label}
            </Button>
          ))}
        </div>
        {hintMargin && (
          <span>{formatMarginHint(question.correctText, hintMargin)}</span>
        )}
      </div>
      {isZeroKeyWithPercent && (
        <p className="text-xs font-extrabold text-foreground/60">
          A percentage of 0 is 0, so only an exact 0 will be accepted — switch
          to an absolute margin to allow near misses.
        </p>
      )}
      <FieldErrors issues={fieldIssues(issues, 'margin')} />
    </div>
  );
}

function NumberFields(props: AnswerFieldsProps) {
  return (
    <>
      <TypedAnswerField {...props} inputType="number" />
      {hasMarginType(props.question.type) && <MarginRow {...props} />}
    </>
  );
}

/** Lists only the modes the question's type accepts; unset shows the type's default. */
function ScoringModeSelect({ question, issues, onChange }: AnswerFieldsProps) {
  const modes = scoringModesOf(question.type);
  const shown = isScoringModeOf(question.type, question.scoringMode)
    ? question.scoringMode
    : gradingSettingsOf({ type: question.type }).scoringMode;
  return (
    <label className="flex flex-col gap-1 text-xs font-extrabold text-foreground/60">
      Scoring
      <select
        value={shown}
        onChange={(event) =>
          onChange({ scoringMode: event.target.value as ScoringMode })
        }
        className="w-full rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
      >
        {modes.map((mode) => (
          <option key={mode} value={mode}>
            {SCORING_MODE_LABELS[mode]}
          </option>
        ))}
      </select>
      <FieldErrors issues={fieldIssues(issues, 'scoringMode')} />
    </label>
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
            disabled={isFixedOnOpened(isOpened, 'options')}
            placeholder="Item text"
            className={TEXT_INPUT_CLASS}
          />
          <Button
            type="button"
            onClick={() => moveSortItem(itemIndex, -1)}
            disabled={isFixedOnOpened(isOpened, 'options') || itemIndex === 0}
            variant="icon"
            size="icon-sm"
            aria-label={`Move item ${itemIndex + 1} up`}
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            onClick={() => moveSortItem(itemIndex, 1)}
            disabled={
              isFixedOnOpened(isOpened, 'options') ||
              itemIndex === question.sortItems.length - 1
            }
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
            disabled={
              isFixedOnOpened(isOpened, 'options') ||
              question.sortItems.length <= 2
            }
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
        disabled={isFixedOnOpened(isOpened, 'options')}
        variant="outline-dashed"
        size="xs"
        className="self-start"
      >
        <PlusIcon aria-hidden="true" />
        Add item
      </Button>
      <ScoringModeSelect
        question={question}
        issues={issues}
        isOpened={isOpened}
        onChange={onChange}
      />
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
            disabled={isFixedOnOpened(isOpened, 'options')}
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
            disabled={isFixedOnOpened(isOpened, 'matchTargets')}
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
            disabled={
              isFixedOnOpened(isOpened, 'options', 'matchTargets') ||
              question.matchPairs.length <= 2
            }
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
        disabled={isFixedOnOpened(isOpened, 'options', 'matchTargets')}
        variant="outline-dashed"
        size="xs"
        className="self-start"
      >
        <PlusIcon aria-hidden="true" />
        Add pair
      </Button>
      <ScoringModeSelect
        question={question}
        issues={issues}
        isOpened={isOpened}
        onChange={onChange}
      />
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
  choice: ChoiceList,
  sort: SortFields,
  match: MatchFields,
} satisfies {
  readonly [K in AnswerKind]: (props: AnswerFieldsProps) => unknown;
};

/** The answer fields for the question's answer kind, resolved from its type. */
export function AnswerSection(props: AnswerFieldsProps) {
  const Fields = ANSWER_KIND_FIELDS[resolveAnswerKind(props.question)];
  return <Fields {...props} />;
}
