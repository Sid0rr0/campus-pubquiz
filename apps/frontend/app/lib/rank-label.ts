/** Rank label for a server-ranked entry: "2." for a clear place, "2.–4." for a tie group spanning those places. */
export function formatRankLabel({
  rank,
  rankTo,
}: {
  rank: number;
  rankTo: number;
}): string {
  return rank === rankTo ? `${rank}.` : `${rank}.–${rankTo}.`;
}
