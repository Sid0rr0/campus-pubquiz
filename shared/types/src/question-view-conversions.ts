import type { GradingSettingsSource } from './answer-key';
import type { Margin } from './margin';
import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  QuestionView,
  SeededQuestion,
} from './question-views';
import { gradingSettingsOf } from './answer-key';
import { QUESTION_KINDS } from './question-kind';

/**
 * The question's margin, resolved by the Answer key, for a type that has one;
 * undefined for every other type, whatever was left on the stored question. A
 * view carries a margin if and only if its type has one.
 */
export function marginOf(question: GradingSettingsSource): Margin | undefined {
  return gradingSettingsOf(question).margin ?? undefined;
}

/**
 * The question without its clues, for every view that is not the reveal: a
 * Clue question keeps its clues in `options`, and none may leave the server
 * before it is shown (a view that shows clues adds the shown ones itself).
 */
export function withoutClues<
  Q extends { type: SeededQuestion['type']; options?: string[] },
>(question: Q): Q {
  if (!QUESTION_KINDS[question.type].hasClues) return question;
  const { options: _clues, ...rest } = question;
  return rest as Q;
}

// Strips the correct answer: this projection is what leaves the process via
// currentQuestion/blockQuestions, broadcast to every phone and the big screen.
export function toQuestionView(question: SeededQuestion): QuestionView {
  const margin = marginOf(question);
  const { options } = withoutClues(question);
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    ...(options !== undefined ? { options } : {}),
    ...(question.matchTargets !== undefined
      ? { matchTargets: question.matchTargets }
      : {}),
    ...(margin !== undefined ? { margin } : {}),
    ...(question.mediaUrl !== undefined ? { mediaUrl: question.mediaUrl } : {}),
    ...(question.mediaStartSeconds !== undefined
      ? { mediaStartSeconds: question.mediaStartSeconds }
      : {}),
    ...(question.mediaEndSeconds !== undefined
      ? { mediaEndSeconds: question.mediaEndSeconds }
      : {}),
    ...(question.isVideoHidden ? { isVideoHidden: true } : {}),
  };
}

// Same answer-stripping, plus the round/question-in-round labels the block
// and break-review headers need.
export function toBlockQuestionView(
  question: BlockRevealQuestionView,
): BlockQuestionView {
  return {
    ...toQuestionView(question),
    roundNumber: question.roundNumber,
    questionNumberInRound: question.questionNumberInRound,
    roundTitle: question.roundTitle,
  };
}
