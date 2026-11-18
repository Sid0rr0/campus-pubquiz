import { ordinal } from '@campus-pubquiz/types';

const defaultWording = (place: string): string => `You're ${place}`;

/**
 * What a team is told about where it stands, from its competition rank (the
 * server's `rank` and `rankTo`): a clear place is worded by `wording`
 * ("You're 4th" by default), a tie group is always "Joint 2nd".
 */
export function placingText(
  { rank, rankTo }: { rank: number; rankTo: number },
  wording: (place: string) => string = defaultWording,
): string {
  return rank === rankTo ? wording(ordinal(rank)) : `Joint ${ordinal(rank)}`;
}
