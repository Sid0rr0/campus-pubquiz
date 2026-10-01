'use client';

import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import type {
  AdvanceSlotStep,
  GameAction,
  GameStatus,
  PreviousState,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface NavigationButtonsProps {
  progressStatus: GameStatus;
  /** What the Advance slot does next, as announced by the server. */
  advanceStep: AdvanceSlotStep;
  /** Whether Previous works, is greyed out under the leaderboard, or is hidden — as announced by the server. */
  previousState: PreviousState;
  onAction: (action: GameAction) => void;
  className?: string;
  /** Rendered between the Previous and Advance buttons — e.g. /remote's MediaFullscreenToggle. */
  children?: ReactNode;
}

function getAdvanceSlotLabel(
  advanceStep: AdvanceSlotStep,
  progressStatus: GameStatus,
): string {
  if (advanceStep === 'reveal_next_rank') {
    return 'Show Next Team';
  }
  if (advanceStep === 'hide_leaderboard') {
    return 'Hide Leaderboard';
  }
  if (progressStatus === 'rules') {
    return 'Begin Quiz';
  }
  if (progressStatus === 'round_overview') {
    return 'Continue';
  }
  if (progressStatus === 'round_intro') {
    return 'Start Round';
  }
  return 'Advance';
}

/** Previous/Advance side by side — the two most-used controls during a live game. */
export function NavigationButtons({
  progressStatus,
  advanceStep,
  previousState,
  onAction,
  className = '',
  children,
}: NavigationButtonsProps) {
  const showAdvanceSlot = advanceStep !== 'none';
  const showPrevious = previousState !== 'unavailable';

  if (!showPrevious && !showAdvanceSlot) {
    return null;
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {showPrevious && (
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAction('PREVIOUS')}
          disabled={previousState === 'covered_by_leaderboard'}
          className="flex-1 disabled:opacity-40"
        >
          <ChevronLeftIcon aria-hidden="true" />
          Previous
        </Button>
      )}
      {children}
      {showAdvanceSlot && (
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAction('ADVANCE')}
          className="flex-1 disabled:opacity-40"
        >
          {getAdvanceSlotLabel(advanceStep, progressStatus)}
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
