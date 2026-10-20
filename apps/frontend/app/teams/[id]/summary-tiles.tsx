import type { TeamStatsSummary } from '@campus-pubquiz/types';
import { ordinal } from '@/app/lib/placing-text';
import { StatTile } from '@/app/stats/[id]/highlight-tiles';

function formatOneDecimal(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

/** A team's history figures; shared by the staff team page and the public one. */
export function SummaryTiles({ summary }: { summary: TeamStatsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatTile
        label="Sessions played"
        value={String(summary.sessionsPlayed)}
      />
      <StatTile label="Wins" value={String(summary.wins)} />
      <StatTile label="Podiums" value={String(summary.podiums)} />
      <StatTile
        label="Best placing"
        value={
          summary.bestPlacing === null ? '—' : ordinal(summary.bestPlacing)
        }
      />
      <StatTile
        label="Avg. placing"
        value={formatOneDecimal(summary.averagePlacing)}
      />
      <StatTile
        label="Avg. share of max points"
        value={
          summary.averageSharePercent === null
            ? '—'
            : `${summary.averageSharePercent.toFixed(0)}%`
        }
      />
      <StatTile
        label="Avg. total points"
        value={formatOneDecimal(summary.averageTotalPoints)}
      />
      <StatTile
        label="Avg. players"
        value={formatOneDecimal(summary.averagePlayerCount)}
      />
    </div>
  );
}
