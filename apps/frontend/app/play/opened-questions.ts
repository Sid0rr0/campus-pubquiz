import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  QuestionType,
} from '@campus-pubquiz/types';

export interface OpenedQuestionEntry {
  id: number;
  type: QuestionType;
  prompt: string;
  roundTitle: string;
  roundNumber: number;
  questionNumberInRound: number;
  myAnswer: string | null;
  /** Set once this question has been revealed, null otherwise. */
  correctAnswer: string | null;
  /** match only: the left-hand items, so myAnswer/correctAnswer can be paired back to them for display. */
  options?: string[];
}

function isRevealed(
  question: BlockQuestionView | BlockRevealQuestionView,
): question is BlockRevealQuestionView {
  return 'answer' in question;
}

/** Every question the team has seen open so far, oldest round/position first, paired with the team's own answer (if any) and the correct answer (once revealed). */
export function buildOpenedQuestions(
  seenQuestions: Record<number, BlockQuestionView | BlockRevealQuestionView>,
  myAnswers: Record<number, string>,
): OpenedQuestionEntry[] {
  return Object.values(seenQuestions)
    .map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      roundTitle: question.roundTitle,
      roundNumber: question.roundNumber,
      questionNumberInRound: question.questionNumberInRound,
      myAnswer: myAnswers[question.id] ?? null,
      correctAnswer: isRevealed(question) ? question.answer : null,
      options: question.options,
    }))
    .sort((a, b) =>
      a.roundNumber !== b.roundNumber
        ? a.roundNumber - b.roundNumber
        : a.questionNumberInRound - b.questionNumberInRound,
    );
}
