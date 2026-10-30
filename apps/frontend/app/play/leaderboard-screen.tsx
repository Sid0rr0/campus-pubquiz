'use client';

import type { LeaderboardBoard } from '@campus-pubquiz/types';
import { JokerStamp } from '@/app/components/joker-stamp';
import { findMyStanding } from '@/app/play/my-standing';
import { placingText } from '@/app/lib/placing-text';
import { useOnLiveForwardMove } from '@/app/lib/live-change';
import { vibrate } from '@/app/lib/vibrate';

interface LeaderboardScreenProps {
  board: LeaderboardBoard;
  /** How many ranks the big screen has revealed so far. */
  revealCount: number;
  myTeamId: number | null;
  isConnected: boolean;
  /** The team's coins, shown next to its points; absent when the session has no power-ups. */
  coins?: number;
}

/**
 * The phone's leaderboard screen: the big screen carries the board, the phone
 * shows only the team's own row once the big screen has revealed it, and
 * buzzes if the team moved up.
 */
export function LeaderboardScreen({
  board,
  revealCount,
  myTeamId,
  isConnected,
  coins,
}: LeaderboardScreenProps) {
  const standing = findMyStanding(board, revealCount, myTeamId);
  useOnLiveForwardMove(standing ? 1 : 0, isConnected, () => {
    if (standing?.trend === 'up') {
      vibrate('rankUp');
    }
  });

  return (
    <div className="mt-16 flex flex-col items-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">
          👀 Look at the screen
        </p>
        <h1 className="font-display text-2xl text-magenta">Leaderboard</h1>
      </div>
      {standing && (
        <div
          data-testid="own-leaderboard-row"
          className="flex w-full max-w-sm flex-col items-center gap-1 rounded-xl border-[3px] border-magenta bg-white px-4 py-3 text-dark-blue shadow-[0_3px_0_#ec008c]"
        >
          {standing.isJokerStamped && <JokerStamp className="text-2xl" />}
          <p className="font-display text-3xl">{placingText(standing.entry)}</p>
          <p className="text-base font-bold">
            {standing.entry.teamName} · {standing.entry.totalPoints} pts
            {coins !== undefined && (
              <> · {coins === 1 ? '1 coin' : `${coins} coins`}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
