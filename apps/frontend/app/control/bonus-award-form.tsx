'use client';

import { useState, type SubmitEvent } from 'react';
import { Cross2Icon, StarIcon } from '@radix-ui/react-icons';
import { bonusCoinsEarned, type BonusCategory } from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_LABELS,
  DEFAULT_BONUS_POINTS,
} from '@/app/lib/bonus-categories';
import { Button } from '@/app/components/button';

interface BonusAwardFormProps {
  /** `coins` is the total coins the award gives (its own shot/selfie coins included; may be negative), passed only when the field shows and the total isn't 0 (or 0 where the award would earn some). */
  onAward: (
    category: BonusCategory,
    points: number,
    reason?: string,
    coins?: number,
  ) => void;
  onCancel: () => void;
  /** Whether the session has power-ups: shows the coins field. */
  isCoinsEnabled?: boolean;
  /** Whether the session has power-ups: a shot or selfie then comes with coins, pre-filled in the coins field. */
  powerUpsEnabled?: boolean;
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
  powerUpsEnabled = false,
}: BonusAwardFormProps) {
  const availablePredefined = PREDEFINED_CATEGORIES.filter((option) =>
    enabledCategories.includes(option.value),
  );
  const isCustomEnabled = enabledCategories.includes('custom');
  const [category, setCategory] = useState<BonusCategory>(() =>
    initialCategory(availablePredefined, isCustomEnabled),
  );
  // Held as the raw typed string (not a number) so an in-progress "-" isn't
  // wiped out by re-rendering through Number("-") === NaN on every keystroke.
  const [typedPoints, setTypedPoints] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const [typedCoins, setTypedCoins] = useState<string | null>(null);
  // Until points are typed: the default, or none once coins taken are typed, so taking a coin never also gives points and a shot's coins.
  const pointsInput = pointsInputOf(typedPoints, typedCoins);

  const points = Number(pointsInput);
  const earned = bonusCoinsEarned(powerUpsEnabled, category, points);
  // Until coins are typed: what the award earns by itself.
  const coinsInput = typedCoins ?? (earned > 0 ? String(earned) : '');
  const coins = coinsInput === '' ? 0 : Number(coinsInput);
  const isCustom = category === 'custom';
  const canSubmit = canSubmitAward(points, coins, isCustom ? reason : null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    const trimmed = isCustom ? reason.trim() : undefined;
    if (coins === 0 && (earned === 0 || !isCoinsEnabled)) {
      onAward(category, points, trimmed);
    } else onAward(category, points, trimmed, coins);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-background/20 bg-background/5 p-2.5 text-xs"
    >
      <div className="flex flex-wrap gap-1">
        {availablePredefined.map((option) => (
          <CategoryChip
            key={option.value}
            label={option.label}
            isSelected={category === option.value}
            onSelect={() => setCategory(option.value)}
          />
        ))}
        {isCustomEnabled && (
          <CategoryChip
            label="Custom"
            isSelected={isCustom}
            onSelect={() => setCategory('custom')}
          />
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
        <CoinsField value={coinsInput} onChange={setTypedCoins} />
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

function initialCategory(
  availablePredefined: readonly { value: BonusCategory }[],
  isCustomEnabled: boolean,
): BonusCategory {
  return availablePredefined[0]?.value ?? (isCustomEnabled ? 'custom' : 'shot');
}

/** Until points are typed: the default, or none once coins are taken (negative), so a take-away never also gives points. */
function pointsInputOf(
  typedPoints: string | null,
  typedCoins: string | null,
): string {
  const isTake = typedCoins !== null && Number(typedCoins) < 0;
  return typedPoints ?? (isTake ? '0' : String(DEFAULT_BONUS_POINTS));
}

/** `customReason` is null for a predefined category. Coins alone (0 points) are a coin award, which needs no reason. */
function canSubmitAward(
  points: number,
  coins: number,
  customReason: string | null,
): boolean {
  return (
    Number.isFinite(points) &&
    Number.isInteger(coins) &&
    (points !== 0 || coins !== 0) &&
    (customReason === null || points === 0 || customReason.trim().length > 0)
  );
}

function CategoryChip({
  label,
  isSelected,
  onSelect,
}: {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`rounded-full border-2 px-2.5 py-1 font-extrabold ${
        isSelected
          ? 'border-cyan bg-cyan text-dark-blue'
          : 'border-background/30 text-background'
      }`}
    >
      {label}
    </Button>
  );
}

function CoinsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 font-bold">
      Coins
      <input
        type="number"
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        aria-label="Coin award"
        className="w-16 rounded border-2 border-background/30 bg-transparent px-2 py-1 placeholder:text-background/40"
      />
    </label>
  );
}
