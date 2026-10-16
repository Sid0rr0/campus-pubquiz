'use client';

import type { StateViewByRoom } from '@campus-pubquiz/types';
import {
  useGameConnection,
  type ConnectionIssue,
} from '@/app/lib/use-game-connection';

export interface UseDisplayGameResult {
  snapshot: StateViewByRoom['display'] | null;
  /** Only ever a connection problem (refused, lost, reconnecting). */
  connectionError: string | null;
  /** `reconnecting` keeps the screen; only `refused` sends the big screen back to the picker. */
  connectionIssue: ConnectionIssue | null;
}

/** The big screen's view of a live session: the snapshot and the connection state, nothing else. */
export function useDisplayGame(
  enabled: boolean,
  joinCode: string | undefined,
): UseDisplayGameResult {
  const { snapshot, connectionError, connectionIssue } = useGameConnection(
    'display',
    enabled,
    joinCode,
  );
  return { snapshot, connectionError, connectionIssue };
}
