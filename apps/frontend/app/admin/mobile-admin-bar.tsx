'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import type { AuthUser, GameAction } from '@campus-pubquiz/types';
import { NavigationButtons } from '@/app/admin/navigation-buttons';
import { AdminActions } from '@/app/admin/admin-actions';
import { BreakEndTimeControl } from '@/app/admin/break-end-time-control';
import { TeamsPanel } from '@/app/admin/teams-panel';
import { SessionStatusPanel } from '@/app/admin/session-status-panel';
import type { AdminSidebarProps } from '@/app/admin/admin-sidebar-props';
import { AccountMenuLinks } from '@/app/components/account-menu-links';
import { Button } from '@/app/components/button';

interface MobileAdminBarProps extends AdminSidebarProps {
  user: AuthUser | null;
  onLogout: () => void;
}

/** Sticky Previous/Advance bar + hamburger drawer for everything else — mobile only. Also carries the account nav (Users/Log out) the site header would otherwise show, since that header is hidden on mobile here. */
export function MobileAdminBar({
  progressStatus,
  roundIndex,
  questionIndex,
  joinCode,
  activeQuizTitle,
  connectionError,
  canStartQuiz,
  canGoToPreviousQuestion,
  canAdvance,
  canEndQuiz,
  canCloseSession,
  isLeaderboardVisible,
  leaderboardRevealCount,
  leaderboardTeamCount,
  onAction,
  onCloseSession,
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
  breakEndsAt,
  onSetBreakEndTime,
  isLastQuestionBeforeBreak,
  user,
  onLogout,
}: MobileAdminBarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleDrawerAction(action: GameAction): void {
    onAction(action);
    setIsDrawerOpen(false);
  }

  function handleDrawerCloseSession(): void {
    onCloseSession();
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
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-foreground p-5 text-background">
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
              <div className="flex flex-col items-center gap-4 font-extrabold text-background pb-2 border-b">
                <AccountMenuLinks user={user} onLogout={onLogout} />
              </div>
            )}
            <SessionStatusPanel
              progressStatus={progressStatus}
              roundIndex={roundIndex}
              questionIndex={questionIndex}
              joinCode={joinCode}
              activeQuizTitle={activeQuizTitle}
              connectionError={connectionError}
            />
            <AdminActions
              canStartQuiz={canStartQuiz}
              canEndQuiz={canEndQuiz}
              canCloseSession={canCloseSession}
              isLeaderboardVisible={isLeaderboardVisible}
              onAction={handleDrawerAction}
              onCloseSession={handleDrawerCloseSession}
            />
            <BreakEndTimeControl
              progressStatus={progressStatus}
              breakEndsAt={breakEndsAt}
              onSetBreakEndTime={onSetBreakEndTime}
              isLastQuestionBeforeBreak={isLastQuestionBeforeBreak}
            />
            <TeamsPanel
              teams={teams}
              showAnswerStatus={showAnswerStatus}
              answeredTeamIds={answeredTeamIds}
              onKickTeam={onKickTeam}
              className="mt-auto border-t border-background/20 pt-4"
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <NavigationButtons
        progressStatus={progressStatus}
        canGoToPreviousQuestion={canGoToPreviousQuestion}
        canAdvance={canAdvance}
        isLeaderboardVisible={isLeaderboardVisible}
        leaderboardRevealCount={leaderboardRevealCount}
        leaderboardTeamCount={leaderboardTeamCount}
        onAction={onAction}
        className="flex-1"
      />
    </div>
  );
}
