import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  QuestionType,
  Verdict,
} from '@campus-pubquiz/types';
import type { MyAnswerGrade } from '@/app/lib/use-player-game';

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
  /** This question's max point value. */
  maxPoints: number;
  /** Points awarded for myAnswer, null until this question is revealed (even if it was graded earlier). */
  pointsAwarded: number | null;
  /** The quiz master's verdict on myAnswer, shown with pointsAwarded — null while either is hidden or ungraded. */
  verdict: Verdict | null;
}

function isRevealed(
  question: BlockQuestionView | BlockRevealQuestionView,
): question is BlockRevealQuestionView {
  return 'answer' in question;
}

/** Every question the team has seen open so far, oldest round/position first, paired with the team's own answer (if any), the correct answer (once revealed), and points awarded plus verdict (shown once the question arrives with its answer — 0 for an unanswered question — even if the answer was actually graded earlier). A question counts as revealed when it arrives with an answer: the players view only carries answers the big screen has already shown. Both come from the team's own synced graded answers, closest_guess included. */
export function buildOpenedQuestions(
  seenQuestions: Record<number, BlockQuestionView | BlockRevealQuestionView>,
  myAnswers: Record<number, string>,
  myAnswerGrades: Record<number, MyAnswerGrade> = {},
): OpenedQuestionEntry[] {
  return Object.values(seenQuestions)
    .map((question) => {
      const myAnswer = myAnswers[question.id] ?? null;
      const revealed = isRevealed(question);
      const grade = revealed ? myAnswerGrades[question.id] : undefined;
      const pointsAwarded = !revealed
        ? null
        : (grade?.pointsAwarded ?? (myAnswer === null ? 0 : null));
      return {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        roundTitle: question.roundTitle,
        roundNumber: question.roundNumber,
        questionNumberInRound: question.questionNumberInRound,
        myAnswer,
        correctAnswer: revealed ? question.answer : null,
        options: question.options,
        maxPoints: question.points,
        pointsAwarded,
        verdict: grade?.verdict ?? null,
      };
    })
    .sort((a, b) =>
      a.roundNumber !== b.roundNumber
        ? a.roundNumber - b.roundNumber
        : a.questionNumberInRound - b.questionNumberInRound,
    );
}
