'use client';

import { useEffect, useRef, useState } from 'react';
import { displaySounds } from '@/app/lib/display-sounds';
import {
  LOBBY_CHIME_MIN_GAP_MS,
  createChimeLimiter,
  findNewTeamIds,
  type ChimeLimiter,
} from '@/app/lib/lobby-chime';

/**
 * Plays the lobby chime when teams join after the roster first rendered
 * (rate-limited). Returns the ids of the teams present at that first render,
 * which must not pop in.
 */
export function useLobbyChime(
  teams: readonly { teamId: number }[],
): ReadonlySet<number> {
  const [initialTeamIds] = useState(
    () => new Set(teams.map((team) => team.teamId)),
  );
  const previousIdsRef = useRef<ReadonlySet<number> | null>(null);
  const limiterRef = useRef<ChimeLimiter | null>(null);

  useEffect(() => {
    limiterRef.current ??= createChimeLimiter(LOBBY_CHIME_MIN_GAP_MS);
    const newIds = findNewTeamIds(previousIdsRef.current, teams);
    previousIdsRef.current = new Set(teams.map((team) => team.teamId));
    if (newIds.length > 0 && limiterRef.current.shouldChime()) {
      displaySounds.play('chime');
    }
  }, [teams]);

  return initialTeamIds;
}
