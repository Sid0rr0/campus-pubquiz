import type { AdminIndicators, LiveRankBoard } from '@campus-pubquiz/types';

/** What the detail column can show: a question, a round's title card or break, or the live leaderboard card. */
export type DetailItem =
  | { kind: 'question'; questionId: number }
  | { kind: 'title'; roundIndex: number }
  | { kind: 'break'; roundIndex: number }
  | { kind: 'leaderboard' }
  /** A block's 🏆 board, by the block's last round. */
  | { kind: 'blockBoard'; roundIndex: number };

export function isSameItem(a: DetailItem | null, b: DetailItem | null) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'leaderboard') return true;
  return a.kind === 'question'
    ? a.questionId === (b as typeof a).questionId
    : a.roundIndex === (b as typeof a).roundIndex;
}

/**
 * The item the big screen shows. The leaderboard card wins while the board
 * is up with callouts. Break review lights the break indicator too, but its title card or question is what's on screen, so the break comes last.
 */
export function onAirItem(
  indicators: AdminIndicators & { liveRankBoard?: LiveRankBoard },
): DetailItem | null {
  if (indicators.liveRankBoard) return { kind: 'leaderboard' };
  if (indicators.titleCardRoundIndex !== null)
    return { kind: 'title', roundIndex: indicators.titleCardRoundIndex };
  if (indicators.onDisplayQuestionId !== null)
    return { kind: 'question', questionId: indicators.onDisplayQuestionId };
  if (indicators.breakRoundIndex !== null)
    return { kind: 'break', roundIndex: indicators.breakRoundIndex };
  return null;
}
