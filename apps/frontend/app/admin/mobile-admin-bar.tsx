'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { GameAction, GameStatus, TeamView } from '@campus-pubquiz/types';
import { NavigationButtons } from '@/app/admin/navigation-buttons';
import { AdminActions } from '@/app/admin/admin-actions';
import { TeamsPanel } from '@/app/admin/teams-panel';

interface MobileAdminBarProps {
  progressStatus: GameStatus;
  joinCode: string;
  activeQuizTitle: string | null;
  connectionError: string | null;
  canStartQuiz: boolean;
  canGoToPreviousQuestion: boolean;
  canAdvance: boolean;
  canFinishGrading: boolean;
  canEndQuiz: boolean;
  onAction: (action: GameAction) => void;
  teams: TeamView[];
  showAnswerStatus: boolean;
  answeredTeamIds: number[];
  onKickTeam: (teamId: number) => void;
}

/** Sticky Previous/Advance bar + hamburger drawer for everything else — mobile only. */
export function MobileAdminBar({
  progressStatus,
  joinCode,
  activeQuizTitle,
  connectionError,
  canStartQuiz,
  canGoToPreviousQuestion,
  canAdvance,
  canFinishGrading,
  canEndQuiz,
  onAction,
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
}: MobileAdminBarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleDrawerAction(action: GameAction): void {
    onAction(action);
    setIsDrawerOpen(false);
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b-2 border-foreground/10 bg-background p-3 md:hidden">
      <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label="Open quiz master menu"
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-foreground/20"
          >
            <span aria-hidden="true" className="h-0.5 w-5 bg-foreground" />
            <span aria-hidden="true" className="h-0.5 w-5 bg-foreground" />
            <span aria-hidden="true" className="h-0.5 w-5 bg-foreground" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-foreground p-5 text-background">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-display text-lg">Quiz Master</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-background/20 text-lg font-extrabold"
                >
                  ×
                </button>
              </Dialog.Close>
            </div>
            {connectionError && (
              <p role="alert" className="font-extrabold text-magenta">
                {connectionError}
              </p>
            )}
            {activeQuizTitle && <p className="text-sm font-bold">Quiz: {activeQuizTitle}</p>}
            <p className="text-sm font-bold">
              Status: {progressStatus} ({joinCode})
            </p>
            <AdminActions
              canStartQuiz={canStartQuiz}
              canFinishGrading={canFinishGrading}
              canEndQuiz={canEndQuiz}
              onAction={handleDrawerAction}
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
        onAction={onAction}
        className="flex-1"
      />
    </div>
  );
}
