import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import {
  BONUS_CATEGORIES,
  type BonusCategory,
  type SessionSettings,
} from '@campus-pubquiz/types';
import {
  BONUS_CATEGORY_LABELS,
  DEFAULT_BONUS_POINTS,
} from '@/app/lib/bonus-categories';
import { Button } from '@/app/components/button';
import { withShowRoundOverview } from '@/app/components/power-ups-settings-form';

interface SessionSettingsFormProps {
  value: SessionSettings;
  onChange: (next: SessionSettings) => void;
  /** A quickfire session has no jokers (switch hidden); only it has the question timer. */
  isQuickfire?: boolean;
}

/** Pure controlled form for the SessionSettings fields — shared by the creation confirm dialog and the lobby settings panel so the fields aren't duplicated in two screens. */
export function SessionSettingsForm({
  value,
  onChange,
  isQuickfire = false,
}: SessionSettingsFormProps) {
  function toggleBonusCategory(category: BonusCategory): void {
    onChange({
      ...value,
      enabledBonusCategories: toggled(value.enabledBonusCategories, category),
    });
  }

  function updateMaxBonusAwards(category: BonusCategory, raw: string): void {
    const maxBonusAwardsPerCategory = { ...value.maxBonusAwardsPerCategory };
    const parsed = parseOptionalNumber(raw);
    if (parsed === null) {
      delete maxBonusAwardsPerCategory[category];
    } else {
      maxBonusAwardsPerCategory[category] = parsed;
    }
    onChange({ ...value, maxBonusAwardsPerCategory });
  }

  function updateQuickfireQuestionTimerSeconds(raw: string): void {
    onChange({
      ...value,
      quickfireQuestionTimerSeconds: parseOptionalNumber(raw),
    });
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

      {isQuickfire && (
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Quickfire question timer (seconds)
          <input
            type="number"
            min={1}
            step={1}
            placeholder="Unlimited"
            value={value.quickfireQuestionTimerSeconds ?? ''}
            onChange={(event) =>
              updateQuickfireQuestionTimerSeconds(event.target.value)
            }
            className="min-h-10 rounded-lg border border-foreground/20 px-3 text-sm font-normal"
          />
          <span className="text-xs font-normal text-foreground/55">
            Leave blank for unlimited time.
          </span>
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold">Bonus categories</span>
        <BonusCategoryToggles
          enabled={value.enabledBonusCategories}
          onToggle={toggleBonusCategory}
        />
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

      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.playLockCountdownSound}
          onChange={(event) =>
            onChange({
              ...value,
              playLockCountdownSound: event.target.checked,
            })
          }
        />
        Countdown sound
      </label>

      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.showRoundOverview}
          // Jokers build on the overview, so it stays on while they are.
          disabled={value.jokersEnabled}
          onChange={(event) =>
            onChange(withShowRoundOverview(value, event.target.checked))
          }
        />
        Show round overview after rules
      </label>

      {!isQuickfire && (
        <>
          <label className="flex items-center gap-2 text-sm font-extrabold">
            <input
              type="checkbox"
              checked={value.jokersEnabled}
              onChange={(event) =>
                onChange(withJokers(value, event.target.checked))
              }
            />
            Jokers
          </label>
          <p className="-mt-3 text-xs text-foreground/60">
            After the round overview each team picks one round whose points
            count double.
          </p>
        </>
      )}

      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.collectFeedback}
          onChange={(event) =>
            onChange({ ...value, collectFeedback: event.target.checked })
          }
        />
        Collect feedback
      </label>

      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.funFactsEnabled}
          onChange={(event) =>
            onChange({ ...value, funFactsEnabled: event.target.checked })
          }
        />
        Fun facts on the break screen
      </label>

      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.listed}
          onChange={(event) =>
            onChange({ ...value, listed: event.target.checked })
          }
        />
        Show in the game list
      </label>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Max players per team
          <input
            type="number"
            min={1}
            step={1}
            value={value.maxPlayersPerTeam}
            onChange={(event) =>
              onChange({
                ...value,
                maxPlayersPerTeam: Number(event.target.value),
              })
            }
            className="min-h-10 w-32 rounded-lg border border-foreground/20 px-3 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Extra player penalty (points)
          <input
            type="number"
            min={0}
            step={1}
            value={value.extraPlayerPenaltyPoints}
            onChange={(event) =>
              onChange({
                ...value,
                extraPlayerPenaltyPoints: Number(event.target.value),
              })
            }
            className="min-h-10 w-32 rounded-lg border border-foreground/20 px-3 text-sm font-normal"
          />
        </label>
      </div>

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
              <Button
                type="button"
                size="icon-md"
                onClick={() => removeRule(index)}
                aria-label={`Remove rule ${index + 1}`}
                className="rounded-lg border border-foreground/20"
              >
                <Cross2Icon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          onClick={addRule}
          variant="outline-dashed"
          size="xs"
          className="w-fit"
        >
          <PlusIcon aria-hidden="true" />
          Add rule
        </Button>
      </div>
    </div>
  );
}

function toggled<T>(items: readonly T[], item: T): T[] {
  return items.includes(item)
    ? items.filter((existing) => existing !== item)
    : [...items, item];
}

/** A typed number, or null for a blank or unreadable cell. */
function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  return trimmed === '' || !Number.isFinite(parsed) ? null : parsed;
}

/** Turning jokers on turns the overview on with them. */
function withJokers(value: SessionSettings, jokersEnabled: boolean) {
  return {
    ...(jokersEnabled ? withShowRoundOverview(value, true) : value),
    jokersEnabled,
  };
}

function BonusCategoryToggles({
  enabled,
  onToggle,
}: {
  enabled: readonly BonusCategory[];
  onToggle: (category: BonusCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BONUS_CATEGORIES.map((category) => (
        <Button
          key={category}
          type="button"
          onClick={() => onToggle(category)}
          aria-pressed={enabled.includes(category)}
          className={`rounded-full border-2 px-3 py-1 text-xs font-extrabold ${
            enabled.includes(category)
              ? 'border-magenta bg-magenta text-white'
              : 'border-foreground/30 text-foreground'
          }`}
        >
          {BONUS_CATEGORY_LABELS[category]}
          <span className="ml-1 font-normal opacity-70">
            ({DEFAULT_BONUS_POINTS} pt)
          </span>
        </Button>
      ))}
    </div>
  );
}
