import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  PlayersStatePayload,
} from '@campus-pubquiz/types';

/** The fields of the players view the seen-questions merge reads. */
export type SeenQuestionsSource = Pick<
  PlayersStatePayload,
  'blockQuestions' | 'revealQuestions' | 'pastRevealedQuestions'
>;

export type SeenQuestions = Record<
  number,
  BlockQuestionView | BlockRevealQuestionView
>;

/** Folds a view's block/reveal questions into the running seen-questions map — later sightings of the same id (e.g. once it's revealed) overwrite earlier ones so the richer view wins. The players view never carries a question that hasn't been shown yet, so everything in it is taken as it arrives. */
export function mergeSeenQuestions(
  current: SeenQuestions,
  payload: SeenQuestionsSource,
): SeenQuestions {
  const additions = [
    ...(payload.blockQuestions ?? []),
    ...(payload.revealQuestions ?? []),
    ...(payload.pastRevealedQuestions ?? []),
  ];
  if (additions.length === 0) {
    return current;
  }
  const next = { ...current };
  for (const question of additions) {
    next[question.id] = question;
  }
  return next;
}
