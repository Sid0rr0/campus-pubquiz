'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, ExitIcon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import type { AuthUser } from '@campus-pubquiz/types';
import { AccountMenuLinks } from '@/app/components/account-menu-links';
import { Button } from '@/app/components/button';
import { CopyButton } from '@/app/components/copy-button';
import type { PlayerMenuState } from '@/app/lib/player-menu-context';

interface MobileHeaderMenuProps {
  accountUser: AuthUser | null;
  onAccountLogout: () => void;
  playerMenu: PlayerMenuState | null;
}

/**
 * Hamburger drawer (top-right, mobile only) for whatever the app header
 * shows inline on desktop: the signed-in admin/moderator's AccountMenuLinks,
 * and/or (on /play) the team's code and Log out button. Same visual pattern
 * as MobileAdminBar's drawer, generalized to live in the shared header
 * itself so every route gets a mobile nav, not just /admin.
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

  return (
    <div className="md:hidden">
      <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant="icon"
            size="icon-lg"
            aria-label="Open menu"
          >
            <HamburgerMenuIcon aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-40 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-foreground p-4 text-background">
            <div className="flex items-center justify-between">
              {/* Generic when AccountMenuLinks below already shows the username; the team name has no other home in this drawer, so it keeps the title slot. */}
              <Dialog.Title className="font-display text-lg">
                {accountUser ? 'Menu' : (playerMenu?.teamName ?? 'Menu')}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  size="icon-lg"
                  aria-label="Close menu"
                  className="rounded-lg border-2 border-background/20 text-lg font-extrabold"
                >
                  <Cross2Icon aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            {accountUser && (
              <div className="flex flex-col items-center gap-4 font-extrabold">
                <AccountMenuLinks
                  user={accountUser}
                  onLogout={handleAccountLogout}
                />
              </div>
            )}
            {playerMenu && (
              <div className="flex flex-col gap-4">
                {playerMenu.team && (
                  <p className="flex flex-wrap items-center gap-1 text-xs text-background/70">
                    Team code: {playerMenu.team.teamCode}
                    <CopyButton value={playerMenu.team.teamCode} /> — save it to
                    play as this team another night.
                  </p>
                )}
                <Button
                  type="button"
                  onClick={handlePlayerLogOut}
                  className="flex items-center gap-1 text-sm font-extrabold underline"
                >
                  <ExitIcon aria-hidden="true" />
                  Log out
                </Button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
