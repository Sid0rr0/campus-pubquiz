'use client';

import {
  BarChartIcon,
  Cross2Icon,
  PlayIcon,
  StopIcon,
} from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface AdminActionsProps {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  isLeaderboardVisible: boolean;
  onAction: (action: GameAction) => void;
  onCloseSession: () => void;
  className?: string;
}

/** Start Quiz, Open/Close Leaderboard, End Quiz, Close Session — everything but Previous/Advance. */
export function AdminActions({
  canStartQuiz,
  canEndQuiz,
  canCloseSession,
  isLeaderboardVisible,
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
      <Button
        variant="outline"
        size="lg"
        onClick={() => onAction('TOGGLE_LEADERBOARD')}
      >
        <BarChartIcon aria-hidden="true" />
        {isLeaderboardVisible ? 'Close Leaderboard' : 'Open Leaderboard'}
      </Button>
      {canEndQuiz && (
        <Button
          size="lg"
          onClick={() => onAction('END_QUIZ')}
          className="rounded-lg border-2 border-background/25 font-extrabold text-background/60"
        >
          <StopIcon aria-hidden="true" />
          End Quiz
        </Button>
      )}
      {canCloseSession && (
        <Button
          size="lg"
          onClick={onCloseSession}
          className="rounded-lg border-2 border-magenta font-extrabold text-magenta"
        >
          <Cross2Icon aria-hidden="true" />
          Close Session
        </Button>
      )}
    </div>
  );
}
