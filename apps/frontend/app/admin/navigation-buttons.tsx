'use client';

import type { GameAction, GameStatus } from '@campus-pubquiz/types';

interface NavigationButtonsProps {
  progressStatus: GameStatus;
  canGoToPreviousQuestion: boolean;
  canAdvance: boolean;
  onAction: (action: GameAction) => void;
  className?: string;
}

function getAdvanceLabel(progressStatus: GameStatus): string {
  if (progressStatus === 'rules') {
    return 'Begin Quiz';
  }
  if (progressStatus === 'round_intro') {
    return 'Start Round';
  }
  return 'Advance';
}

/** Previous/Advance side by side — the two most-used controls during a live game. */
export function NavigationButtons({
  progressStatus,
  canGoToPreviousQuestion,
  canAdvance,
  onAction,
  className = '',
}: NavigationButtonsProps) {
  if (!canGoToPreviousQuestion && !canAdvance) {
    return null;
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {canGoToPreviousQuestion && (
        <button
          onClick={() => onAction('PREVIOUS')}
          className="min-h-11 flex-1 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
        >
          Previous
        </button>
      )}
      {canAdvance && (
        <button
          onClick={() => onAction('ADVANCE')}
          className="min-h-11 flex-1 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
        >
          {getAdvanceLabel(progressStatus)}
        </button>
      )}
    </div>
  );
}
