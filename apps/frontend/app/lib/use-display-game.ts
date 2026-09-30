'use client';

import type { StateViewByRoom } from '@campus-pubquiz/types';
import { useGameConnection } from '@/app/lib/use-game-connection';

export interface UseDisplayGameResult {
  snapshot: StateViewByRoom['display'] | null;
  /** Only ever a connection problem (refused, lost, reconnecting). */
  connectionError: string | null;
}

/** The big screen's view of a live session: the snapshot and the connection state, nothing else. */
export function useDisplayGame(
  enabled: boolean,
  joinCode: string | undefined,
): UseDisplayGameResult {
  const { snapshot, connectionError } = useGameConnection(
    'display',
    enabled,
    joinCode,
  );
  return { snapshot, connectionError };
}
