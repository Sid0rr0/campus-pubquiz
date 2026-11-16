import {
  POWER_UP_LABELS,
  type PowerUpId,
  type SessionDetailPowerUpRow,
  type SessionDetailPowerUps,
} from '@campus-pubquiz/types';
import { formatPercent } from '@/app/stats/[id]/format-percent';
import { StatTile } from '@/app/stats/[id]/highlight-tiles';

const HEADERS = ['Power-up', 'Uses', 'Teams', 'Coins spent', 'Effect'];

function labels(ids: readonly PowerUpId[]): string {
  return ids.length === 0
    ? '—'
    : ids.map((id) => POWER_UP_LABELS[id]).join(', ');
}

/** The hit rate with its count ("80% · 4 of 5"), or the extra joker's points gained. */
function effect({ uses, hits, pointsGained }: SessionDetailPowerUpRow): string {
  if (pointsGained !== null) return `+${pointsGained} points`;
  if (hits === null || uses === 0) return '—';
  // A partial answer credits a share of a hit.
  return `${formatPercent(hits / uses)} · ${Number(hits.toFixed(1))} of ${uses}`;
}

export function PowerUpsSection({
  powerUps,
}: {
  powerUps: SessionDetailPowerUps | null;
}) {
  if (!powerUps) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg">Power-ups</h2>
      {powerUps.totalUses === 0 ? (
        <p className="text-foreground/60">No power-ups used</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatTile
              label="Power-ups used"
              value={String(powerUps.totalUses)}
            />
            <StatTile label="Coins spent" value={String(powerUps.coinsSpent)} />
            <StatTile label="Most used" value={labels(powerUps.mostUsed)} />
            <StatTile
              label="Most effective"
              value={labels(powerUps.mostEffective)}
              detail="highest hit rate"
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-foreground/15">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-foreground/15 bg-foreground/5">
                  {HEADERS.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2 font-display text-sm text-foreground/70"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {powerUps.rows.map((row) => (
                  <tr
                    key={row.powerUp}
                    className="border-b border-foreground/10 last:border-b-0"
                  >
                    <td className="px-4 py-2">
                      {POWER_UP_LABELS[row.powerUp]}
                    </td>
                    <td className="px-4 py-2">{row.uses}</td>
                    <td className="px-4 py-2">{row.teamCount}</td>
                    <td className="px-4 py-2">{row.coinsSpent}</td>
                    <td className="px-4 py-2">{effect(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
