'use client';

import type { GameAction } from '@campus-pubquiz/types';

interface AdminActionsProps {
  canStartQuiz: boolean;
  canFinishGrading: boolean;
  canEndQuiz: boolean;
  onAction: (action: GameAction) => void;
  className?: string;
}

/** Start Quiz, Finish Grading, Toggle Leaderboard, End Quiz — everything but Previous/Advance. */
export function AdminActions({
  canStartQuiz,
  canFinishGrading,
  canEndQuiz,
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
      {canFinishGrading && (
        <button
          onClick={() => onAction('FINISH_GRADING')}
          className="min-h-12 rounded-lg bg-magenta text-sm font-extrabold text-white"
        >
          Finish Grading
        </button>
      )}
      <button
        onClick={() => onAction('TOGGLE_LEADERBOARD')}
        className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
      >
        Toggle Leaderboard
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
