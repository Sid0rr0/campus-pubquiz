/** The fewest players a team can report. */
export const MIN_PLAYER_COUNT = 1;
/** The most players a team can report. */
export const MAX_PLAYER_COUNT = 20;

/** A team reporting how many players it has; the ack says whether it was saved. Replaces whatever the team reported before. */
export interface SetPlayerCountPayload {
  /** A whole number from MIN_PLAYER_COUNT to MAX_PLAYER_COUNT. */
  playerCount: number;
}

/** Sent to a team's own phone after its player count changed, so every phone of the team shows the same number. */
export interface TeamPlayerCountSyncedPayload {
  playerCount: number;
}
