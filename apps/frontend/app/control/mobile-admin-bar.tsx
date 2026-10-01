'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import type { AuthUser, GameAction } from '@campus-pubquiz/types';
import { NavigationButtons } from '@/app/control/navigation-buttons';
import { AdminActions } from '@/app/control/admin-actions';
import { BreakEndTimeControl } from '@/app/control/break-end-time-control';
import { DisplayTextScaleControl } from '@/app/control/display-text-scale-control';
import { EditQuizLink } from '@/app/control/edit-quiz-link';
import { ShowdownPanel } from '@/app/control/showdown-panel';
import { TeamsPanel } from '@/app/control/teams-panel';
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
  const { view, quiz, connectionError, controls, actions } = panel;
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
              progressStatus={progress.status}
              roundIndex={progress.roundIndex}
              questionIndex={progress.questionIndex}
              joinCode={view.joinCode}
              activeQuizTitle={quiz.title}
              connectionError={connectionError}
            />
            <AdminActions
              canStartQuiz={controls.canStartQuiz}
              canEndQuiz={controls.canEndQuiz}
              canCloseSession={controls.canCloseSession}
              isLeaderboardVisible={progress.isLeaderboardVisible}
              isMediaFullscreen={progress.isMediaFullscreen ?? false}
              canReplayMedia={controls.canReplayMedia}
              onAction={handleDrawerAction}
              onCloseSession={handleDrawerCloseSession}
            />
            <BreakEndTimeControl
              progressStatus={progress.status}
              breakEndsAt={view.breakEndsAt}
              onSetBreakEndTime={actions.setBreakEndTime}
              isLastQuestionBeforeBreak={view.isLastQuestionBeforeBreak}
            />
            <DisplayTextScaleControl
              displayTextScale={view.displayTextScale}
              onSetDisplayTextScale={actions.setDisplayTextScale}
            />
            <EditQuizLink quizId={quiz.id} />
            <ShowdownPanel
              isEligible={view.isShowdownEligible}
              activeShowdown={view.activeShowdown}
              tiedTeamNames={controls.tiedTeamNames}
              onCreateShowdownRound={actions.createShowdownRound}
            />
            <TeamsPanel
              teams={view.teams}
              showAnswerStatus={controls.showAnswerStatus}
              answeredTeamIds={view.answeredTeamIds}
              onKickTeam={actions.kickTeam}
              className="mt-auto border-t border-background/20 pt-4"
            />
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
    </div>
  );
}
