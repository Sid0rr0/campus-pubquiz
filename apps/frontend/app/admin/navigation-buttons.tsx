'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type { GameAction, GameStatus } from '@campus-pubquiz/types';

interface NavigationButtonsProps {
  progressStatus: GameStatus;
  canGoToPreviousQuestion: boolean;
  canAdvance: boolean;
  isLeaderboardVisible: boolean;
  leaderboardRevealCount: number;
  leaderboardTeamCount: number;
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
  isLeaderboardVisible,
  leaderboardRevealCount,
  leaderboardTeamCount,
  onAction,
  className = '',
}: NavigationButtonsProps) {
  // While the board is up, Advance takes over revealing teams one at a time;
  // once every team has been shown it reverts to its normal role.
  const hasUnrevealedTeams =
    isLeaderboardVisible && leaderboardRevealCount < leaderboardTeamCount;
  const showAdvanceSlot = canAdvance || hasUnrevealedTeams;

  if (!canGoToPreviousQuestion && !showAdvanceSlot) {
    return null;
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {canGoToPreviousQuestion && (
        <button
          onClick={() => onAction('PREVIOUS')}
          disabled={isLeaderboardVisible}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan disabled:opacity-40"
        >
          <ChevronLeftIcon aria-hidden="true" />
          Previous
        </button>
      )}
      {showAdvanceSlot && (
        <button
          onClick={() =>
            onAction(hasUnrevealedTeams ? 'REVEAL_NEXT_TEAM' : 'ADVANCE')
          }
          disabled={isLeaderboardVisible && !hasUnrevealedTeams}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan disabled:opacity-40"
        >
          {hasUnrevealedTeams
            ? 'Show Next Team'
            : getAdvanceLabel(progressStatus)}
          <ChevronRightIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
