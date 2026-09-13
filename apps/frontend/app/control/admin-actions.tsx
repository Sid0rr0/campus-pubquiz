'use client';

import {
  Cross2Icon,
  EyeClosedIcon,
  EyeOpenIcon,
  PlayIcon,
  StopIcon,
} from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';
import { MediaFullscreenToggle } from '@/app/control/media-fullscreen-toggle';
import { ReplayMediaButton } from '@/app/control/replay-media-button';

interface AdminActionsProps {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  isLeaderboardVisible: boolean;
  isMediaFullscreen: boolean;
  canReplayMedia: boolean;
  onAction: (action: GameAction) => void;
  onCloseSession: () => void;
  className?: string;
}

/** Start Quiz, Leaderboard toggle (+ fullscreen/replay media controls), End Quiz, Close Session — everything but Previous/Advance. */
export function AdminActions({
  canStartQuiz,
  canEndQuiz,
  canCloseSession,
  isLeaderboardVisible,
  isMediaFullscreen,
  canReplayMedia,
  onAction,
  onCloseSession,
  className = '',
}: AdminActionsProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {canStartQuiz && (
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAction('START_QUIZ')}
        >
          <PlayIcon aria-hidden="true" />
          Start Quiz
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAction('TOGGLE_LEADERBOARD')}
          className="flex-1"
        >
          {isLeaderboardVisible ? (
            <EyeClosedIcon aria-hidden="true" />
          ) : (
            <EyeOpenIcon aria-hidden="true" />
          )}
          Leaderboard
        </Button>
        <MediaFullscreenToggle
          isMediaFullscreen={isMediaFullscreen}
          onAction={onAction}
          tone="dark"
        />
        <ReplayMediaButton
          canReplay={canReplayMedia}
          onAction={onAction}
          tone="dark"
        />
      </div>
      {canEndQuiz && (
        <ConfirmDialog
          trigger={
            <Button
              size="lg"
              className="rounded-lg border-2 border-background/25 font-extrabold text-background/60"
            >
              <StopIcon aria-hidden="true" />
              End Quiz
            </Button>
          }
          title="End this quiz?"
          description="This immediately ends the quiz for everyone and shows the final leaderboard. This can't be undone."
          confirmLabel="End Quiz"
          onConfirm={() => onAction('END_QUIZ')}
        />
      )}
      {canCloseSession && (
        <ConfirmDialog
          trigger={
            <Button
              size="lg"
              className="rounded-lg border-2 border-magenta font-extrabold text-magenta"
            >
              <Cross2Icon aria-hidden="true" />
              Close Session
            </Button>
          }
          title="Close this session?"
          description="This removes it from the active sessions list for everyone. This can't be undone."
          confirmLabel="Close Session"
          onConfirm={onCloseSession}
        />
      )}
    </div>
  );
}
