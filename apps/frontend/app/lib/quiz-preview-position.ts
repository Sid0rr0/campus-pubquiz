import type { QuizPreviewMode, QuizPreviewStep } from '@campus-pubquiz/types';

/**
 * A step's position in the preview URL's `?at=`: the round and question it
 * shows (`r2`, `r2q3`), plus a suffix for the screens that share a position
 * with another (a question's answer, a block's break and reveal intros, the
 * round overview). Rounds and questions are numbered from 1, as on screen.
 */
const KIND_SUFFIXES: Partial<
  Record<QuizPreviewStep['screen']['kind'], string>
> = {
  reveal: '-answer',
  reveal_intro: '-reveals',
  break_intro: '-break',
  round_overview: '-overview',
  joker_pick: '-jokers',
};

/** The position of a round's title card, or of a question when `questionIndex` is given. */
export function previewPosition(
  roundIndex: number,
  questionIndex: number | null = null,
): string {
  return questionIndex === null
    ? `r${roundIndex + 1}`
    : `r${roundIndex + 1}q${questionIndex + 1}`;
}

export function stepPosition(step: QuizPreviewStep): string {
  return (
    previewPosition(step.roundIndex, step.questionIndex) +
    (KIND_SUFFIXES[step.screen.kind] ?? '')
  );
}

/** The step a `?at=` names, or the first step when it names nothing (absent, malformed or from another order). */
export function stepIndexAt(
  steps: readonly QuizPreviewStep[],
  at: string | null,
): number {
  // Stryker disable next-line ConditionalExpression: no step's position equals null, so findIndex gives -1 and the max below gives 0 anyway
  if (at === null) return 0;
  return Math.max(
    0,
    steps.findIndex((step) => stepPosition(step) === at),
  );
}

/** The preview page of a saved quiz, optionally in an order, with jokers and at a position. The default order, jokers off and the first step are left out. */
export function quizPreviewHref(
  quizId: number | string,
  options: { mode?: QuizPreviewMode; withJokers?: boolean; at?: string } = {},
): string {
  const params = new URLSearchParams();
  if (options.mode) params.set('mode', options.mode);
  if (options.withJokers) params.set('jokers', 'true');
  if (options.at) params.set('at', options.at);
  const query = params.toString();
  return `/quizzes/${quizId}/preview${query ? `?${query}` : ''}`;
}
