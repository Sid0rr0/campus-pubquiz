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
  // once every team has been shown, it hides the board instead of sitting
  // disabled — the underlying status (e.g. a round's title card) has already
  // advanced and is just waiting to be uncovered by a further press.
  const hasUnrevealedTeams =
    isLeaderboardVisible && leaderboardRevealCount < leaderboardTeamCount;
  const shouldHideLeaderboard =
    isLeaderboardVisible && !hasUnrevealedTeams && canAdvance;
  const showAdvanceSlot = canAdvance || hasUnrevealedTeams;

  if (!canGoToPreviousQuestion && !showAdvanceSlot) {
    return null;
  }

  const advanceSlotAction: GameAction = hasUnrevealedTeams
    ? 'REVEAL_NEXT_TEAM'
    : shouldHideLeaderboard
      ? 'TOGGLE_LEADERBOARD'
      : 'ADVANCE';
  const advanceSlotLabel = hasUnrevealedTeams
    ? 'Show Next Team'
    : shouldHideLeaderboard
      ? 'Hide Leaderboard'
      : getAdvanceLabel(progressStatus);

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
          onClick={() => onAction(advanceSlotAction)}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan disabled:opacity-40"
        >
          {advanceSlotLabel}
          <ChevronRightIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
