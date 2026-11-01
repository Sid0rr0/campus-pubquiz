'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import type { AuthUser, GameAction } from '@campus-pubquiz/types';
import { NavigationButtons } from '@/app/control/navigation-buttons';
import { PanelControls, PanelTeams } from '@/app/control/panel-controls';
import { PhaseTimer } from '@/app/control/phase-timer';
import { SessionStatusPanel } from '@/app/control/session-status-panel';
import type { ControlPanel } from '@/app/control/control-panel';
import { AccountMenuLinks } from '@/app/components/account-menu-links';
import { Button } from '@/app/components/button';

interface MobileAdminBarProps {
  panel: ControlPanel;
  user: AuthUser | null;
  onLogout: () => void;
}

/** Sticky Previous/Advance bar + hamburger drawer for everything else — mobile only. Also carries the account nav (Users/Log out) the site header would otherwise show, since that header is hidden on mobile here. */
export function MobileAdminBar({ panel, user, onLogout }: MobileAdminBarProps) {
  const { view, quiz, connectionError, actions } = panel;
  const { progress } = view;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleDrawerAction(action: GameAction): void {
    actions.sendAction(action);
    setIsDrawerOpen(false);
  }

  function handleDrawerCloseSession(): void {
    actions.closeSession();
    setIsDrawerOpen(false);
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b-2 border-foreground/10 bg-background p-3 md:hidden">
      <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant="icon"
            aria-label="Open quiz master menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <HamburgerMenuIcon aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay fixed inset-0 z-30 bg-foreground/60" />
          <Dialog.Content className="drawer-left fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-foreground p-5 text-background">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-display text-lg">
                Quiz Master
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
            {user && (
              <div className="drawer-nav border-b border-background/20 pb-4">
                <AccountMenuLinks user={user} onLogout={onLogout} />
              </div>
            )}
            <SessionStatusPanel
              progressStatus={progress.status}
              roundIndex={progress.roundIndex}
              questionIndex={progress.questionIndex}
              joinCode={view.joinCode}
              activeQuizTitle={quiz.title}
              connectionError={connectionError}
            />
            <PanelControls
              panel={panel}
              onAction={handleDrawerAction}
              onCloseSession={handleDrawerCloseSession}
            />
            <PanelTeams panel={panel} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <NavigationButtons
        progressStatus={progress.status}
        advanceStep={view.advanceStep}
        previousState={view.previousState}
        onAction={actions.sendAction}
        className="flex-1"
      />
      <PhaseTimer
        phaseStartedAt={view.phaseStartedAt}
        phaseElapsedMs={view.phaseElapsedMs}
        className="shrink-0"
      />
    </div>
  );
}
