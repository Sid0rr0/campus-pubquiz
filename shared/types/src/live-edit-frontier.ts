/**
 * Where the live sessions on a quiz have got to, merged across them — the
 * one description both the backend's save guard and the quiz editor read, so
 * the two never disagree about what may change (ADR 0002). Game progress is
 * positional, so nothing at or before this point may move.
 */
export interface LiveEditFrontier {
  /** `Question.id`s opened in any live session, for good — Previous never takes one away. */
  openedQuestionIds: number[];
  /** Index of the current round of the furthest-on live session. */
  currentRoundIndex: number;
}

/** Combines per-session frontiers: every opened question counts, and the line is the furthest-on session's current round. */
export function mergeLiveEditFrontiers(
  frontiers: readonly LiveEditFrontier[],
): LiveEditFrontier {
  return {
    openedQuestionIds: [
      ...new Set(frontiers.flatMap((frontier) => frontier.openedQuestionIds)),
    ],
    currentRoundIndex: Math.max(
      ...frontiers.map((frontier) => frontier.currentRoundIndex),
    ),
  };
}

/** A round at or before the frontier's current round can't change structurally — its questions can't be added, removed, reordered or moved in or out. Rounds after it can. */
export function isRoundStructureFrozen(
  frontier: LiveEditFrontier,
  roundIndex: number,
): boolean {
  return roundIndex <= frontier.currentRoundIndex;
}
