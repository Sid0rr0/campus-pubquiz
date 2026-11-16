const TEEN_OR_ABOVE = 20;
const TENS_IN_HUNDRED = 100;
const TENS = 10;

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 21 -> "21st". */
export function ordinal(n: number): string {
  const lastTwo = n % TENS_IN_HUNDRED;
  // Stryker disable next-line EqualityOperator: 10 and 20 end in 0, which takes "th" from the fallback, so moving either bound by one changes nothing
  const isTeen = lastTwo >= TENS && lastTwo < TEEN_OR_ABOVE;
  const suffix = isTeen
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % TENS] ||
      'th';
  return `${n}${suffix}`;
}
