'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import {
  Cross2Icon,
  ExitIcon,
  GearIcon,
  HamburgerMenuIcon,
} from '@radix-ui/react-icons';
import type { AuthUser } from '@campus-pubquiz/types';
import {
  AccountMenuLinks,
  LeagueLink,
  MyTeamLink,
} from '@/app/components/account-menu-links';
import { Button } from '@/app/components/button';
import { CopyButton } from '@/app/components/copy-button';
import type { PlayerMenuState } from '@/app/lib/player-menu-context';

interface MobileHeaderMenuProps {
  accountUser: AuthUser | null;
  onAccountLogout: () => void;
  playerMenu: PlayerMenuState | null;
}

/**
 * Hamburger drawer (top-right; SiteHeader decides the breakpoint) for whatever the app header
 * shows inline on desktop: the signed-in admin/moderator's AccountMenuLinks,
 * and/or (on /play) the team's code and Log out button. Same visual pattern
 * as MobileAdminBar's drawer, generalized to live in the shared header
 * itself so every route gets a mobile nav, not just /control.
 */
export function MobileHeaderMenu({
  accountUser,
  onAccountLogout,
  playerMenu,
}: MobileHeaderMenuProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleAccountLogout(): void {
    onAccountLogout();
    setIsDrawerOpen(false);
  }

  function handlePlayerLogOut(): void {
    playerMenu?.onLogOut();
    setIsDrawerOpen(false);
  }

  function handleOpenSettings(): void {
    playerMenu?.onOpenSettings();
    setIsDrawerOpen(false);
  }

  // The header outlives navigation, so any link in the drawer closes it.
  function handleNavClick(event: React.MouseEvent): void {
    if ((event.target as Element).closest('a')) {
      setIsDrawerOpen(false);
    }
  }

  return (
    <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="icon"
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center"
        >
          <HamburgerMenuIcon aria-hidden="true" className="h-5 w-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-30 bg-foreground/60" />
        <Dialog.Content className="drawer-right fixed inset-y-0 right-0 z-40 flex w-80 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-foreground px-4 pb-6 text-background shadow-[-16px_0_36px_rgba(46,49,146,0.25)]">
          <div className="-mx-4 flex h-(--site-header-height) shrink-0 items-center justify-between gap-3 border-b border-background/15 px-4">
            {/* Generic when AccountMenuLinks below already shows the username; the team name has no other home in this drawer, so it keeps the title slot. */}
            <Dialog.Title className="truncate font-display text-xl font-extrabold">
              {accountUser ? 'Menu' : (playerMenu?.teamName ?? 'Menu')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                aria-label="Close menu"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-background/20 transition-colors hover:bg-background/10 focus-visible:outline-2 focus-visible:outline-magenta"
              >
                <Cross2Icon aria-hidden="true" className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>
          {playerMenu && (
            <div className="flex flex-col gap-3">
              {playerMenu.team && (
                <div className="flex flex-col gap-2 rounded-xl bg-background/10 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-background/70">
                    Team code
                  </p>
                  <span className="break-words font-display text-xl font-extrabold uppercase tracking-wider">
                    {playerMenu.team.teamCode}
                  </span>
                  <CopyButton
                    value={playerMenu.team.teamCode}
                    text={true}
                    className="self-start border-background/40! text-background!"
                  />
                  <p className="text-xs font-bold text-background/70">
                    Save it to play as this team another night.
                  </p>
                </div>
              )}
              <div className="drawer-nav">
                <Button
                  type="button"
                  onClick={handleOpenSettings}
                  className="nav-item"
                >
                  <GearIcon aria-hidden="true" />
                  Settings
                </Button>
                <Button
                  type="button"
                  onClick={handlePlayerLogOut}
                  className="nav-item"
                >
                  <ExitIcon aria-hidden="true" />
                  Change team
                </Button>
              </div>
            </div>
          )}
          <nav
            aria-label="Site"
            onClick={handleNavClick}
            className={`drawer-nav ${playerMenu ? 'border-t border-background/15 pt-4' : ''}`}
          >
            {accountUser ? (
              <AccountMenuLinks
                user={accountUser}
                onLogout={handleAccountLogout}
              />
            ) : (
              <>
                <LeagueLink />
                <MyTeamLink />
              </>
            )}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
