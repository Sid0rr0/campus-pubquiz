import type { AdminIndicators } from '@campus-pubquiz/types';

/** What the detail column can show: a question, a round's title card, or a round's break. */
export type DetailItem =
  | { kind: 'question'; questionId: number }
  | { kind: 'title'; roundIndex: number }
  | { kind: 'break'; roundIndex: number };

export function isSameItem(a: DetailItem | null, b: DetailItem | null) {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === 'question'
    ? a.questionId === (b as typeof a).questionId
    : a.roundIndex === (b as typeof a).roundIndex;
}

/** The item the big screen shows. Break review lights the break indicator too, but its title card or question is what's on screen, so the break comes last. */
export function onAirItem(indicators: AdminIndicators): DetailItem | null {
  if (indicators.titleCardRoundIndex !== null)
    return { kind: 'title', roundIndex: indicators.titleCardRoundIndex };
  if (indicators.onDisplayQuestionId !== null)
    return { kind: 'question', questionId: indicators.onDisplayQuestionId };
  if (indicators.breakRoundIndex !== null)
    return { kind: 'break', roundIndex: indicators.breakRoundIndex };
  return null;
}
