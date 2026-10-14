import { placingText } from '@/app/lib/placing-text';

const PODIUM_SIZE = 3;

interface RankedTeam {
  teamId: number;
  rank: number;
  rankTo: number;
}

export interface FinalPlacing {
  text: string;
  rank: number;
}

/** Whether a (competition) rank gets confetti on the phone. */
export function isPodiumRank(rank: number): boolean {
  return rank <= PODIUM_SIZE;
}

/**
 * The phone's "You finished 4th of 12" line, from the server's competition
 * rank ("Joint 2nd" for a tie group). Null when the team isn't on the board.
 */
export function describeFinalPlacing(
  board: readonly RankedTeam[],
  teamId: number | null,
): FinalPlacing | null {
  const mine = board.find((entry) => entry.teamId === teamId);
  if (!mine) {
    return null;
  }
  return {
    text: `You finished ${placingText(mine, (place) => place)} of ${board.length}`,
    rank: mine.rank,
  };
}
