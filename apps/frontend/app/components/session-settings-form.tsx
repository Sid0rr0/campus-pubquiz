import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import {
  BONUS_CATEGORIES,
  type BonusCategory,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { DEFAULT_BONUS_POINTS } from '@/app/admin/bonus-award-form';

interface SessionSettingsFormProps {
  value: SessionSettings;
  onChange: (next: SessionSettings) => void;
}

const BONUS_CATEGORY_LABELS: Record<BonusCategory, string> = {
  shot: 'Shot',
  selfie: 'Selfie',
  custom: 'Custom',
};

/** Pure controlled form for the SessionSettings fields — shared by the creation confirm dialog and the lobby settings panel so the fields aren't duplicated in two screens. */
export function SessionSettingsForm({
  value,
  onChange,
}: SessionSettingsFormProps) {
  function toggleBonusCategory(category: BonusCategory): void {
    const enabledBonusCategories = value.enabledBonusCategories.includes(
      category,
    )
      ? value.enabledBonusCategories.filter((c) => c !== category)
      : [...value.enabledBonusCategories, category];
    onChange({ ...value, enabledBonusCategories });
  }

  function updateMaxBonusAwards(category: BonusCategory, raw: string): void {
    const trimmed = raw.trim();
    const maxBonusAwardsPerCategory = { ...value.maxBonusAwardsPerCategory };
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed)) {
      delete maxBonusAwardsPerCategory[category];
    } else {
      maxBonusAwardsPerCategory[category] = parsed;
    }
    onChange({ ...value, maxBonusAwardsPerCategory });
  }

  function updateRule(index: number, text: string): void {
    const rules = value.rules.map((rule, i) => (i === index ? text : rule));
    onChange({ ...value, rules });
  }

  function addRule(): void {
    onChange({ ...value, rules: [...value.rules, ''] });
  }

  function removeRule(index: number): void {
    onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Lock round after (seconds)
        <input
          type="number"
          min={1}
          step={1}
          value={value.lockGraceSeconds}
          onChange={(event) =>
            onChange({
              ...value,
              lockGraceSeconds: Number(event.target.value),
            })
          }
          className="min-h-10 rounded-lg border border-foreground/20 px-3 text-sm font-normal"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold">Bonus categories</span>
        <div className="flex flex-wrap gap-2">
          {BONUS_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => toggleBonusCategory(category)}
              aria-pressed={value.enabledBonusCategories.includes(category)}
              className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold ${
                value.enabledBonusCategories.includes(category)
                  ? 'border-magenta bg-magenta text-white'
                  : 'border-foreground/30 text-foreground'
              }`}
            >
              {BONUS_CATEGORY_LABELS[category]}
              <span className="ml-1 font-normal opacity-70">
                ({DEFAULT_BONUS_POINTS} pt)
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold">
          Max times awarded per team
        </span>
        <div className="flex flex-wrap gap-3">
          {value.enabledBonusCategories.map((category) => (
            <label
              key={category}
              className="flex items-center gap-2 text-xs font-bold"
            >
              {BONUS_CATEGORY_LABELS[category]}
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="No limit"
                  value={value.maxBonusAwardsPerCategory[category] ?? ''}
                  onChange={(event) =>
                    updateMaxBonusAwards(category, event.target.value)
                  }
                  aria-label={`Max ${BONUS_CATEGORY_LABELS[category]} awards`}
                  className="w-24 min-h-9 rounded-lg border border-foreground/20 px-2 text-sm font-normal"
                />
                <span className="font-normal text-foreground/50">times</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.autoplayMedia}
          onChange={(event) =>
            onChange({ ...value, autoplayMedia: event.target.checked })
          }
        />
        Autoplay media
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold">Rules</span>
        <ul className="flex flex-col gap-2">
          {value.rules.map((rule, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={rule}
                onChange={(event) => updateRule(index, event.target.value)}
                aria-label={`Rule ${index + 1}`}
                className="min-h-9 flex-1 rounded-lg border border-foreground/20 px-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeRule(index)}
                aria-label={`Remove rule ${index + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/20"
              >
                <Cross2Icon aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addRule}
          className="flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-foreground/20 px-3 text-xs font-extrabold"
        >
          <PlusIcon aria-hidden="true" />
          Add rule
        </button>
      </div>
    </div>
  );
}
