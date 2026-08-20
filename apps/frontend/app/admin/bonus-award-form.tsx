'use client';

import { useState, type FormEvent } from 'react';
import { Cross2Icon, StarIcon } from '@radix-ui/react-icons';
import type { BonusCategory } from '@campus-pubquiz/types';

interface BonusAwardFormProps {
  onAward: (category: BonusCategory, points: number, reason?: string) => void;
  onCancel: () => void;
  /** This session's enabled bonus categories — hides any predefined button not in the list, and the "Custom" button unless 'custom' is included. */
  enabledCategories: BonusCategory[];
}

const PREDEFINED_CATEGORIES: Array<{ value: BonusCategory; label: string }> = [
  { value: 'shot', label: 'Shot' },
  { value: 'selfie', label: 'Selfie' },
];

const DEFAULT_POINTS = 1;

/** Inline award form shown per-team in TeamsPanel — predefined categories default to 1 point (editable); custom requires a typed-in reason. */
export function BonusAwardForm({
  onAward,
  onCancel,
  enabledCategories,
}: BonusAwardFormProps) {
  const availablePredefined = PREDEFINED_CATEGORIES.filter((option) =>
    enabledCategories.includes(option.value),
  );
  const isCustomEnabled = enabledCategories.includes('custom');
  const [category, setCategory] = useState<BonusCategory>(
    availablePredefined[0]?.value ?? (isCustomEnabled ? 'custom' : 'shot'),
  );
  // Held as the raw typed string (not a number) so an in-progress "-" isn't
  // wiped out by re-rendering through Number("-") === NaN on every keystroke.
  const [pointsInput, setPointsInput] = useState(String(DEFAULT_POINTS));
  const [reason, setReason] = useState('');

  const points = Number(pointsInput);
  const isCustom = category === 'custom';
  const canSubmit =
    Number.isFinite(points) &&
    points !== 0 &&
    (!isCustom || reason.trim().length > 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    onAward(category, points, isCustom ? reason.trim() : undefined);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-background/20 bg-background/5 p-2.5 text-xs"
    >
      <div className="flex flex-wrap gap-1">
        {availablePredefined.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCategory(option.value)}
            aria-pressed={category === option.value}
            className={`rounded-full border-2 px-2.5 py-1 font-extrabold ${
              category === option.value
                ? 'border-cyan bg-cyan text-dark-blue'
                : 'border-background/30 text-background'
            }`}
          >
            {option.label}
          </button>
        ))}
        {isCustomEnabled && (
          <button
            type="button"
            onClick={() => setCategory('custom')}
            aria-pressed={isCustom}
            className={`rounded-full border-2 px-2.5 py-1 font-extrabold ${
              isCustom
                ? 'border-cyan bg-cyan text-dark-blue'
                : 'border-background/30 text-background'
            }`}
          >
            Custom
          </button>
        )}
      </div>
      {isCustom && (
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason"
          aria-label="Bonus reason"
          className="rounded border-2 border-background/30 bg-transparent px-2 py-1 text-background placeholder:text-background/40"
        />
      )}
      <label className="flex items-center gap-2 font-bold">
        Points
        <input
          type="number"
          step={1}
          value={pointsInput}
          onChange={(event) => setPointsInput(event.target.value)}
          aria-label="Bonus points"
          className="w-16 rounded border-2 border-background/30 bg-transparent px-2 py-1"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-1 rounded-full bg-magenta px-3 py-1 font-extrabold text-background disabled:opacity-40"
        >
          <StarIcon aria-hidden="true" />
          Award
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-full border-2 border-background/30 px-3 py-1 font-bold"
        >
          <Cross2Icon aria-hidden="true" />
          Cancel
        </button>
      </div>
    </form>
  );
}
