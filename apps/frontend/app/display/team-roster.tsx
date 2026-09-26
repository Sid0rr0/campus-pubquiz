'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { TeamView } from '@campus-pubquiz/types';

const TEAM_CHIP_TEXT_CLASSES = [
  'text-cyan',
  'text-magenta',
  'text-green',
  'text-orange',
];

const MARQUEE_PX_PER_SECOND = 80;
const MIN_MARQUEE_DURATION_SECONDS = 8;

const ROW_CLASSES = 'flex items-center gap-x-6';
// Falls back to a static, multi-line wrap for prefers-reduced-motion, regardless of the
// measured overflow state — see the long comment on useIsOverflowing for why that's safe.
const REDUCED_MOTION_FALLBACK_CLASSES =
  'motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center';

interface TeamRosterProps {
  teams: TeamView[];
}

/**
 * Tracks whether `rowRef`'s content is wider than `viewportRef`, re-measuring on resize.
 *
 * `rowRef` must always point at a single, never-duplicated, unwrapped (`whitespace-nowrap`)
 * copy of the roster — never a `flex-wrap`/`w-full` one. Once an element's width is clamped
 * by wrapping, its `scrollWidth` collapses to roughly the container's width, so a roster that
 * was ever measured as "fits" could never again be measured as overflowing. The reduced-motion
 * fallback does apply `flex-wrap` via a `motion-reduce:` CSS variant, but that only matters
 * visually under `prefers-reduced-motion: reduce`, where both the "fits" and "overflows"
 * branches already render identically (static, wrapped, no animation) — so a stale measurement
 * while that variant is active has no visible effect.
 */
function useIsOverflowing(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  rowRef: React.RefObject<HTMLDivElement | null>,
  deps: readonly unknown[],
) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [rowWidthPx, setRowWidthPx] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const row = rowRef.current;
    if (!viewport || !row) return;

    const measure = () => {
      setRowWidthPx(row.scrollWidth);
      setIsOverflowing(row.scrollWidth > viewport.clientWidth);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(row);
    return () => observer.disconnect();
    // `isOverflowing` isn't read here, but it's a dependency: it changes which branch renders
    // rowRef's underlying DOM node, so the effect must rerun to observe the new node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, isOverflowing]);

  return { isOverflowing, rowWidthPx };
}

export function TeamRoster({ teams }: TeamRosterProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const { isOverflowing, rowWidthPx } = useIsOverflowing(viewportRef, rowRef, [
    teams,
  ]);

  const renderTeamName = (team: TeamView, index: number) => (
    <span
      key={team.teamId}
      className={`font-display text-display-2xl whitespace-nowrap ${TEAM_CHIP_TEXT_CLASSES[index % TEAM_CHIP_TEXT_CLASSES.length]}`}
    >
      {team.teamName}
    </span>
  );

  const marqueeDurationSeconds = Math.max(
    rowWidthPx / MARQUEE_PX_PER_SECOND,
    MIN_MARQUEE_DURATION_SECONDS,
  );

  return (
    <div
      aria-label="Connected teams"
      className="flex flex-col items-center gap-3 px-16 pt-6 pb-10"
    >
      <p className="text-display-lg font-extrabold tracking-wide">
        {teams.length} {teams.length === 1 ? 'TEAM' : 'TEAMS'} JOINED
      </p>
      <div
        ref={viewportRef}
        className={`w-full overflow-hidden motion-reduce:mask-none ${
          isOverflowing
            ? 'mask-[linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]'
            : ''
        }`}
      >
        {isOverflowing ? (
          <div
            className={`w-max animate-marquee items-center motion-reduce:w-full motion-reduce:animate-none ${ROW_CLASSES}`}
            style={
              {
                '--marquee-duration': `${marqueeDurationSeconds}s`,
              } as React.CSSProperties
            }
          >
            <div
              ref={rowRef}
              className={`whitespace-nowrap pr-6 ${ROW_CLASSES} ${REDUCED_MOTION_FALLBACK_CLASSES}`}
            >
              {teams.map(renderTeamName)}
            </div>
            <div
              aria-hidden="true"
              className={`whitespace-nowrap pr-6 motion-reduce:hidden ${ROW_CLASSES}`}
            >
              {teams.map(renderTeamName)}
            </div>
          </div>
        ) : (
          <div
            ref={rowRef}
            className={`mx-auto w-max whitespace-nowrap ${ROW_CLASSES} ${REDUCED_MOTION_FALLBACK_CLASSES}`}
          >
            {teams.map(renderTeamName)}
          </div>
        )}
      </div>
    </div>
  );
}
