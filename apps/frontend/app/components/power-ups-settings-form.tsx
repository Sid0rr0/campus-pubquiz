import {
  defaultExtraJokerCost,
  POWER_UP_IDS,
  POWER_UP_LABELS,
  type PowerUpId,
  type PowerUpSetting,
  type SessionSettings,
} from '@campus-pubquiz/types';

interface PowerUpsSettingsFormProps {
  value: SessionSettings;
  onChange: (next: SessionSettings) => void;
}

const NUMBER_INPUT_CLASS =
  'w-20 min-h-9 rounded-lg border border-foreground/20 px-2 text-sm font-normal';

/** The Power-ups tab of the settings: the switch, the starting coins, and per power-up an offered checkbox (stored as `maxUses`, 0 = not offered), its cost and its uses per team. */
export function PowerUpsSettingsForm({
  value,
  onChange,
}: PowerUpsSettingsFormProps) {
  function update(id: PowerUpId, patch: Partial<PowerUpSetting>): void {
    onChange({
      ...value,
      powerUps: {
        ...value.powerUps,
        [id]: { ...value.powerUps[id], ...patch },
      },
    });
  }

  const toNumber = (raw: string): number =>
    Math.max(0, Math.trunc(Number(raw)));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input
          type="checkbox"
          checked={value.powerUpsEnabled}
          onChange={(event) =>
            onChange({ ...value, powerUpsEnabled: event.target.checked })
          }
        />
        Power-ups
      </label>
      <p className="-mt-3 text-xs text-foreground/60">
        Teams spend coins on one-off helps. Coins are never points.
      </p>

      {value.powerUpsEnabled && (
        <>
          <label className="flex flex-col gap-1 text-sm font-extrabold">
            Starting coins
            <input
              type="number"
              min={0}
              step={1}
              value={value.startingCoins}
              onChange={(event) =>
                onChange({
                  ...value,
                  startingCoins: toNumber(event.target.value),
                })
              }
              className={`${NUMBER_INPUT_CLASS} w-32`}
            />
          </label>

          <ul className="flex flex-col gap-2">
            {POWER_UP_IDS.map((id) => {
              const setting = value.powerUps[id];
              const label = POWER_UP_LABELS[id];
              const isOffered = setting.maxUses > 0;
              return (
                <li key={id} className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-36 items-center gap-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={isOffered}
                      onChange={(event) =>
                        update(id, { maxUses: event.target.checked ? 1 : 0 })
                      }
                    />
                    {label}
                  </label>
                  {isOffered && (
                    <>
                      <label className="flex items-center gap-1 text-xs font-bold">
                        Cost
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={setting.cost}
                          aria-label={`${label} cost`}
                          onChange={(event) =>
                            update(id, { cost: toNumber(event.target.value) })
                          }
                          className={NUMBER_INPUT_CLASS}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs font-bold">
                        Max uses per team
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={setting.maxUses}
                          aria-label={`${label} max uses`}
                          onChange={(event) =>
                            update(id, {
                              maxUses: Math.max(
                                1,
                                toNumber(event.target.value),
                              ),
                            })
                          }
                          className={NUMBER_INPUT_CLASS}
                        />
                      </label>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** Applies a round overview change; the extra joker's cost follows it (3 with the overview, 2 without) while it still holds the old default. */
export function withShowRoundOverview(
  value: SessionSettings,
  showRoundOverview: boolean,
): SessionSettings {
  const isCostDefault =
    value.powerUps.extra_joker.cost ===
    defaultExtraJokerCost(value.showRoundOverview);
  return {
    ...value,
    showRoundOverview,
    powerUps: isCostDefault
      ? {
          ...value.powerUps,
          extra_joker: {
            ...value.powerUps.extra_joker,
            cost: defaultExtraJokerCost(showRoundOverview),
          },
        }
      : value.powerUps,
  };
}
