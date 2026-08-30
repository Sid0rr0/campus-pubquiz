import {
  getTimedPhaseKey,
  type GameContext,
  type GameProgress,
} from '@campus-pubquiz/types';

/**
 * Computes the next "live frontier" state for one transition.
 *
 * There is at most one live timed phase at a time — the frontier: the most
 * recent genuinely-new question or grading block to open. Only a genuinely
 * new phase opening ever moves the frontier; Previous, and any detour
 * through an untimed status (round_intro, reveal, ended, ...), never touch
 * it — so a question that's still the frontier keeps ticking in the
 * background no matter how far the admin browses away from it, and shows
 * its full elapsed time (undiminished by the detour) the moment it's
 * displayed again. Once a phase is superseded, its final elapsed-ms is
 * banked once, immutably — re-displaying it later (via Previous) always
 * shows that same fixed value.
 */
export function computePhaseTimerFields(
  newProgress: GameProgress,
  context: GameContext,
  currentLivePhaseKey: string | null,
  currentPhaseStartedAt: number | null,
  currentPhaseElapsedByKey: Record<string, number>,
): {
  livePhaseKey: string | null;
  phaseStartedAt: number | null;
  phaseElapsedByKey: Record<string, number>;
} {
  const newKey = getTimedPhaseKey(newProgress, context);

  const isGenuinelyNewPhase =
    newKey !== null &&
    newKey !== currentLivePhaseKey &&
    currentPhaseElapsedByKey[newKey] === undefined;

  if (!isGenuinelyNewPhase) {
    return {
      livePhaseKey: currentLivePhaseKey,
      phaseStartedAt: currentPhaseStartedAt,
      phaseElapsedByKey: currentPhaseElapsedByKey,
    };
  }

  const phaseElapsedByKey =
    currentLivePhaseKey !== null && currentPhaseStartedAt !== null
      ? {
          ...currentPhaseElapsedByKey,
          [currentLivePhaseKey]: Date.now() - currentPhaseStartedAt,
        }
      : currentPhaseElapsedByKey;

  return {
    livePhaseKey: newKey,
    phaseStartedAt: Date.now(),
    phaseElapsedByKey,
  };
}
