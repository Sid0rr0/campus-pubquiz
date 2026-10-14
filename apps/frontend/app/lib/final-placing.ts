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

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
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
  const joint = mine.rank === mine.rankTo ? '' : 'Joint ';
  return {
    text: `You finished ${joint}${ordinal(mine.rank)} of ${board.length}`,
    rank: mine.rank,
  };
}
