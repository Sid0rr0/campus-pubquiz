import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  QuestionView,
  RevealQuestionView,
} from '@campus-pubquiz/types';

// Strips the correct answer: this projection is what leaves the process via
// currentQuestion/blockQuestions, broadcast to every phone and the big screen.
export function toQuestionView(question: RevealQuestionView): QuestionView {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    ...(question.options !== undefined ? { options: question.options } : {}),
    ...(question.matchTargets !== undefined
      ? { matchTargets: question.matchTargets }
      : {}),
    ...(question.mediaUrl !== undefined ? { mediaUrl: question.mediaUrl } : {}),
    ...(question.mediaStartSeconds !== undefined
      ? { mediaStartSeconds: question.mediaStartSeconds }
      : {}),
    ...(question.mediaEndSeconds !== undefined
      ? { mediaEndSeconds: question.mediaEndSeconds }
      : {}),
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
