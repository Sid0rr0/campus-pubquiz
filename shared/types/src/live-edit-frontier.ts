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
  /** The current block has started locking (or is past it, in its break or reveal) in the furthest-on live session — its rounds can't gain, lose or reorder questions any more. */
  hasCurrentBlockStartedLocking: boolean;
}

/** Combines per-session frontiers: every opened question counts, and the line is the furthest-on session's current round — locking only counts for a session standing on that round, since earlier rounds are frozen anyway. */
export function mergeLiveEditFrontiers(
  frontiers: readonly LiveEditFrontier[],
): LiveEditFrontier {
  const currentRoundIndex = Math.max(
    ...frontiers.map((frontier) => frontier.currentRoundIndex),
  );
  return {
    openedQuestionIds: [
      ...new Set(frontiers.flatMap((frontier) => frontier.openedQuestionIds)),
    ],
    currentRoundIndex,
    hasCurrentBlockStartedLocking: frontiers.some(
      (frontier) =>
        frontier.currentRoundIndex === currentRoundIndex &&
        frontier.hasCurrentBlockStartedLocking,
    ),
  };
}

/**
 * How far a round's questions can be restructured:
 * - `frozen`: no question can be added, removed, reordered or moved in or out
 * - `after-opened`: the round's opened questions stay at its start, in order;
 *   the questions after them can change freely
 * - `free`: any change
 */
export type RoundStructureEditing = 'frozen' | 'after-opened' | 'free';

export function getRoundStructureEditing(
  frontier: LiveEditFrontier,
  roundIndex: number,
): RoundStructureEditing {
  if (roundIndex < frontier.currentRoundIndex) return 'frozen';
  if (roundIndex > frontier.currentRoundIndex) return 'free';
  return frontier.hasCurrentBlockStartedLocking ? 'frozen' : 'after-opened';
}

/** A round whose questions can't be added, removed, reordered or moved in or out. */
export function isRoundStructureFrozen(
  frontier: LiveEditFrontier,
  roundIndex: number,
): boolean {
  return getRoundStructureEditing(frontier, roundIndex) === 'frozen';
}

/** How many questions at the start of a round are pinned in place: everything up to the last opened one (questions open in order, so those are the opened ones). Questions not yet saved have no id and are never opened. */
export function getOpenedPrefixLength(
  questionIds: readonly (number | undefined)[],
  openedQuestionIds: ReadonlySet<number>,
): number {
  return (
    questionIds.findLastIndex(
      (id) => id !== undefined && openedQuestionIds.has(id),
    ) + 1
  );
}

/** A round the live sessions have reached (the current round or an earlier one): it keeps its place, break-after and kahoot setting, and can't be deleted. The rounds after it can be added, deleted and reordered, and those settings can change. */
export function isRoundReached(
  frontier: LiveEditFrontier,
  roundIndex: number,
): boolean {
  return roundIndex <= frontier.currentRoundIndex;
}

/** Why a round's structure is frozen: a live session has reached it, or it is the current round and its block has started locking. */
export type RoundLockReason = 'reached' | 'block-locking';

/** What the live sessions allow for one round — the single description the editor and the backend's save guard both read. */
export interface RoundEditingDescription {
  /** A live session has reached it: it keeps its place, break-after and kahoot setting, and can't be deleted. */
  isReached: boolean;
  structureEditing: RoundStructureEditing;
  /** Questions at the start of the round that must stay in place. */
  pinnedQuestionCount: number;
  /** A question moved from another round may be added to it. */
  canTakeMovedQuestion: boolean;
  /** Why its structure is frozen, or null when it isn't. */
  lockReason: RoundLockReason | null;
}

/** A round as the description needs it: its questions' saved ids, `undefined` for ones not saved yet. */
export interface LiveEditRoundShape {
  questionIds: readonly (number | undefined)[];
}

/** Describes each round against the merged frontier, in the rounds' order. */
export function describeLiveEditRounds(
  frontier: LiveEditFrontier,
  rounds: readonly LiveEditRoundShape[],
): RoundEditingDescription[] {
  const openedIds = new Set(frontier.openedQuestionIds);
  return rounds.map((round, roundIndex) => {
    const structureEditing = getRoundStructureEditing(frontier, roundIndex);
    return {
      isReached: isRoundReached(frontier, roundIndex),
      structureEditing,
      pinnedQuestionCount: pinnedCountFor(
        structureEditing,
        round.questionIds,
        openedIds,
      ),
      canTakeMovedQuestion: structureEditing !== 'frozen',
      lockReason: lockReasonFor(frontier, roundIndex, structureEditing),
    };
  });
}

function pinnedCountFor(
  editing: RoundStructureEditing,
  questionIds: readonly (number | undefined)[],
  openedIds: ReadonlySet<number>,
): number {
  switch (editing) {
    case 'frozen':
      return questionIds.length;
    case 'after-opened':
      return getOpenedPrefixLength(questionIds, openedIds);
    case 'free':
      return 0;
  }
}

function lockReasonFor(
  frontier: LiveEditFrontier,
  roundIndex: number,
  editing: RoundStructureEditing,
): RoundLockReason | null {
  if (editing !== 'frozen') return null;
  return roundIndex === frontier.currentRoundIndex
    ? 'block-locking'
    : 'reached';
}
