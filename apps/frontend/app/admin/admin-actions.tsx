'use client';

import type { GameAction } from '@campus-pubquiz/types';

interface AdminActionsProps {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  isLeaderboardVisible: boolean;
  onAction: (action: GameAction) => void;
  className?: string;
}

/** Start Quiz, Open/Close Leaderboard, End Quiz — everything but Previous/Advance. */
export function AdminActions({
  canStartQuiz,
  canEndQuiz,
  isLeaderboardVisible,
  onAction,
  className = '',
}: AdminActionsProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {canStartQuiz && (
        <button
          onClick={() => onAction('START_QUIZ')}
          className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
        >
          Start Quiz
        </button>
      )}
      <button
        onClick={() => onAction('TOGGLE_LEADERBOARD')}
        className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
      >
        {isLeaderboardVisible ? 'Close Leaderboard' : 'Open Leaderboard'}
      </button>
      {canEndQuiz && (
        <button
          onClick={() => onAction('END_QUIZ')}
          className="min-h-11 rounded-lg border-2 border-background/25 text-sm font-extrabold text-background/60"
        >
          End Quiz
        </button>
      )}
    </div>
  );
}
