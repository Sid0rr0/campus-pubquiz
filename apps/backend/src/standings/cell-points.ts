/**
 * The points a team shows for one answer in a read model that lays answers out
 * cell by cell (the scoresheet, the session detail, the team history). Every
 * such cell reads its points here rather than from the stored answer, so the
 * joker (ADR 0004) lands in one place and the cells keep adding up to the
 * team's total: an answer in the team's joker round counts double.
 */
export function cellPoints(answer: {
  pointsAwarded: number;
  /** The answer is to a question of its team's joker round (absent reads as false). */
  isJoker?: boolean;
}): number {
  return answer.isJoker ? answer.pointsAwarded * 2 : answer.pointsAwarded;
}
