const TEEN_OR_ABOVE = 20;
const TENS_IN_HUNDRED = 100;
const TENS = 10;

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 21 -> "21st". */
export function ordinal(n: number): string {
  const lastTwo = n % TENS_IN_HUNDRED;
  const isTeen = lastTwo >= TENS && lastTwo < TEEN_OR_ABOVE;
  const suffix = isTeen
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % TENS] ||
      'th';
  return `${n}${suffix}`;
}

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
