'use client';

import { useState, type SubmitEvent } from 'react';
import { Cross2Icon, StarIcon } from '@radix-ui/react-icons';
import type { BonusCategory } from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_LABELS,
  DEFAULT_BONUS_POINTS,
} from '@/app/lib/bonus-categories';
import { Button } from '@/app/components/button';

interface BonusAwardFormProps {
  /** `coins` is passed only when the form gave some (a manual coin award, apart from the points; may be negative). */
  onAward: (
    category: BonusCategory,
    points: number,
    reason?: string,
    coins?: number,
  ) => void;
  onCancel: () => void;
  /** Whether the session has power-ups: shows the coins field. */
  isCoinsEnabled?: boolean;
  /** This session's enabled bonus categories — hides any predefined button not in the list, and the "Custom" button unless 'custom' is included. */
  enabledCategories: BonusCategory[];
}

const PREDEFINED_CATEGORIES: Array<{ value: BonusCategory; label: string }> = [
  { value: 'shot', label: BONUS_CATEGORY_LABELS.shot },
  { value: 'selfie', label: BONUS_CATEGORY_LABELS.selfie },
];

/** Inline award form shown per-team in TeamsPanel — predefined categories default to 1 point (editable); custom requires a typed-in reason. */
export function BonusAwardForm({
  onAward,
  onCancel,
  enabledCategories,
  isCoinsEnabled = false,
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
  const [typedPoints, setTypedPoints] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const [coinsInput, setCoinsInput] = useState('');
  // Until points are typed: the default, or none once coins are, so taking a coin never also gives points and a shot's coins.
  const pointsInput =
    typedPoints ?? (coinsInput === '' ? String(DEFAULT_BONUS_POINTS) : '0');

  const points = Number(pointsInput);
  const coins = coinsInput === '' ? 0 : Number(coinsInput);
  const isCustom = category === 'custom';
  // Coins alone (0 points) are a coin award, which needs no reason.
  const canSubmit =
    Number.isFinite(points) &&
    Number.isInteger(coins) &&
    (points !== 0 || coins !== 0) &&
    (!isCustom || points === 0 || reason.trim().length > 0);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    const trimmed = isCustom ? reason.trim() : undefined;
    if (coins === 0) onAward(category, points, trimmed);
    else onAward(category, points, trimmed, coins);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-background/20 bg-background/5 p-2.5 text-xs"
    >
      <div className="flex flex-wrap gap-1">
        {availablePredefined.map((option) => (
          <Button
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
          </Button>
        ))}
        {isCustomEnabled && (
          <Button
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
          </Button>
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
          onChange={(event) => setTypedPoints(event.target.value)}
          aria-label="Bonus points"
          className="w-16 rounded border-2 border-background/30 bg-transparent px-2 py-1"
        />
      </label>
      {isCoinsEnabled && (
        <label className="flex items-center gap-2 font-bold">
          Coins
          <input
            type="number"
            step={1}
            value={coinsInput}
            onChange={(event) => setCoinsInput(event.target.value)}
            placeholder="0"
            aria-label="Coin award"
            className="w-16 rounded border-2 border-background/30 bg-transparent px-2 py-1 placeholder:text-background/40"
          />
        </label>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-magenta font-extrabold text-background disabled:opacity-40"
        >
          <StarIcon aria-hidden="true" />
          Award
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1 rounded-full border-2 border-background/30 font-bold"
        >
          <Cross2Icon aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
