'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { JoinAcceptedPayload } from '@campus-pubquiz/types';

export interface PlayerMenuState {
  teamName: string;
  team: JoinAcceptedPayload | null;
  onLogOut: () => void;
}

type PublishPlayerMenu = (state: PlayerMenuState | null) => void;

// Split into two contexts (state vs. the stable setter) so that publishing
// from /play doesn't re-render the publisher itself on every change — only
// SiteHeader, which actually reads the state, re-renders.
const PlayerMenuStateContext = createContext<PlayerMenuState | null>(null);
const PublishPlayerMenuContext = createContext<PublishPlayerMenu>(() => {});

/**
 * Bridges the team identity/log-out action owned by /play's useTeamJoin (a
 * route-local hook) up to the shared SiteHeader, which is a layout-level
 * sibling with no direct access to it — mirrors AuthProvider's role for the
 * admin/moderator side of the same header.
 */
export function PlayerMenuProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [playerMenu, setPlayerMenu] = useState<PlayerMenuState | null>(null);
  return (
    <PublishPlayerMenuContext.Provider value={setPlayerMenu}>
      <PlayerMenuStateContext.Provider value={playerMenu}>
        {children}
      </PlayerMenuStateContext.Provider>
    </PublishPlayerMenuContext.Provider>
  );
}

/** Read side — used by SiteHeader to render the player's mobile menu on /play. */
export function usePlayerMenu(): PlayerMenuState | null {
  return useContext(PlayerMenuStateContext);
}

/**
 * Write side — used by /play to publish its team identity/log-out into the
 * shared app header, and clear it again on unmount so a later page doesn't
 * show a stale team menu.
 */
export function usePublishPlayerMenu(
  teamName: string | null,
  team: JoinAcceptedPayload | null,
  onLogOut: () => void,
): void {
  const publish = useContext(PublishPlayerMenuContext);
  useEffect(() => {
    publish(teamName ? { teamName, team, onLogOut } : null);
    return () => publish(null);
  }, [teamName, team, onLogOut, publish]);
}
