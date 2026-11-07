import type { TeamJoker } from './joker';
import type { PowerUpId } from './power-ups';

/** A purchase, as far as doubling needs it: round power-ups carry a round id, question power-ups and blind purchases none. */
export interface DoublingPurchase {
  powerUp: PowerUpId;
  roundId: number | null;
}

/** The rounds a team doubles: its joker round and every round it bought an extra joker for, each once (no round counts more than double). */
export function doubledRoundIds(
  jokerRoundId: number | undefined,
  purchases: readonly DoublingPurchase[],
): number[] {
  const ids = purchases.flatMap((purchase) =>
    purchase.powerUp === 'extra_joker' && purchase.roundId !== null
      ? [purchase.roundId]
      : [],
  );
  return [
    ...new Set(jokerRoundId === undefined ? ids : [jokerRoundId, ...ids]),
  ];
}

/** `doubledRoundIds` for one team, from a session's jokers and its purchase list. */
export function doubledRoundIdsOfTeam(
  jokers: Readonly<Record<number, TeamJoker>>,
  purchases: readonly (DoublingPurchase & { teamId: number })[],
  teamId: number,
): number[] {
  return doubledRoundIds(
    jokers[teamId]?.roundId,
    purchases.filter((purchase) => purchase.teamId === teamId),
  );
}
