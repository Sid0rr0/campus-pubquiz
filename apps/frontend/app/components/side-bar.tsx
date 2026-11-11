import type { CSSProperties } from 'react';
import { versusSideColor, type SideStandings } from '@campus-pubquiz/types';

/**
 * The Versus bar: one segment per side sized by its share, and under it each
 * side's name, average points and percentage. The `ownSideId` side (the
 * phone's) is highlighted.
 *
 * Only `transform` animates (CODING_STANDARDS): each segment is a full-width
 * layer scaled to its share counted from its own end of the bar. The first half
 * of the sides grows from the left edge and the rest from the right, so the bar
 * fills from the outside in when it first appears (`@starting-style`).
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
  const fromRightIndex = Math.ceil(sides.length / 2);
  const shareSum = (from: number, to: number) =>
    sides.slice(from, to).reduce((sum, side) => sum + side.share, 0);
  return (
    <div data-testid="side-bar" className="flex w-full flex-col gap-2">
      <div className="relative h-4 w-full overflow-hidden rounded-full">
        {sides.map((side, index) => {
          const isFromRight = index >= fromRightIndex;
          // Each layer reaches from its edge to its side's far boundary; the
          // layer nearer the middle sits underneath, so each shows only its share.
          const scale = isFromRight
            ? shareSum(index, sides.length)
            : shareSum(0, index + 1);
          return (
            <div
              key={side.id}
              data-testid={`side-segment-${side.id}`}
              className={`absolute inset-0 [transform:scaleX(var(--side-scale))] transition-transform duration-1000 ease-out motion-reduce:transition-none starting:[transform:scaleX(0)] ${isFromRight ? 'origin-right' : 'origin-left'}`}
              style={
                {
                  '--side-scale': Math.min(scale, 1),
                  zIndex: isFromRight ? index : sides.length - index,
                  backgroundColor: versusSideColor(side.colorIndex),
                } as CSSProperties
              }
            />
          );
        })}
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
