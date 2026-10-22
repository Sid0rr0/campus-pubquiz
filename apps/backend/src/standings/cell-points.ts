/**
 * The points a team shows for one answer in a read model that lays answers out
 * cell by cell (the scoresheet, the session detail, the team history). Every
 * such cell reads its points here rather than from the stored answer, so a rule
 * that changes what an answer counts for (the joker, ADR 0004) lands in one
 * place and the cells keep adding up to the team's total.
 */
export function cellPoints(answer: { pointsAwarded: number }): number {
  return answer.pointsAwarded;
}
