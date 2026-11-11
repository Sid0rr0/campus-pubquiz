import { versusSideColor, type SideStandings } from '@campus-pubquiz/types';

/**
 * The Versus bar: one segment per side sized by its share, and under it each
 * side's name, average points and percentage. The `ownSideId` side (the
 * phone's) is highlighted.
 *
 * Only `transform` animates (CODING_STANDARDS): each segment is a full-width
 * layer scaled to its cumulative share, stacked so the first side sits on top.
 */
export function SideBar({
  standings,
  ownSideId = null,
}: {
  /** Absent without Versus: nothing is drawn. */
  standings?: SideStandings;
  ownSideId?: string | null;
}) {
  if (!standings) return null;
  const { sides } = standings;
  let cumulative = 0;
  const segmentEnds = sides.map((side) => (cumulative += side.share));
  return (
    <div data-testid="side-bar" className="flex w-full flex-col gap-2">
      <div className="relative h-4 w-full overflow-hidden rounded-full">
        {sides.map((side, index) => (
          <div
            key={side.id}
            data-testid={`side-segment-${side.id}`}
            className="absolute inset-0 origin-left transition-transform duration-1000 ease-in-out motion-reduce:transition-none"
            style={{
              transform: `scaleX(${Math.min(segmentEnds[index], 1)})`,
              zIndex: sides.length - index,
              backgroundColor: versusSideColor(side.colorIndex),
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap justify-between gap-2 text-sm">
        {sides.map((side) => {
          const isOwn = side.id === ownSideId;
          return (
            <li
              key={side.id}
              data-own={isOwn}
              className={`flex flex-col rounded-lg px-2 py-1 ${isOwn ? 'bg-foreground/10 font-extrabold ring-2 ring-foreground/40' : ''}`}
              style={{
                borderBottom: `3px solid ${versusSideColor(side.colorIndex)}`,
              }}
            >
              <span>
                {side.name}
                {isOwn && ' (you)'}
              </span>
              {side.average === null ? (
                <>
                  <span className="text-foreground/65">No teams</span>
                  <span>{formatPercent(side.share)}</span>
                </>
              ) : (
                <span>
                  {formatAverage(side.average)} pts avg ·{' '}
                  {formatPercent(side.share)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatAverage(average: number): string {
  return String(Math.round(average * 10) / 10);
}

function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
