'use client';

import {
  BarChartIcon,
  Cross2Icon,
  PlayIcon,
  StopIcon,
} from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';

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
        <button
          onClick={() => onAction('START_QUIZ')}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
        >
          <PlayIcon aria-hidden="true" />
          Start Quiz
        </button>
      )}
      <button
        onClick={() => onAction('TOGGLE_LEADERBOARD')}
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
      >
        <BarChartIcon aria-hidden="true" />
        {isLeaderboardVisible ? 'Close Leaderboard' : 'Open Leaderboard'}
      </button>
      {canEndQuiz && (
        <button
          onClick={() => onAction('END_QUIZ')}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-background/25 text-sm font-extrabold text-background/60"
        >
          <StopIcon aria-hidden="true" />
          End Quiz
        </button>
      )}
      {canCloseSession && (
        <button
          onClick={onCloseSession}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-magenta text-sm font-extrabold text-magenta"
        >
          <Cross2Icon aria-hidden="true" />
          Close Session
        </button>
      )}
    </div>
  );
}
