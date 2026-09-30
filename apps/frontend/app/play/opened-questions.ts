import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  GameStatus,
  QuestionType,
  Verdict,
} from '@campus-pubquiz/types';
import type { MyAnswerGrade } from '@/app/lib/use-player-game';

/** The current snapshot's reveal walk — lets points be gated to "shown on display yet", not just "block has started revealing". */
interface ActiveRevealWalk {
  status: GameStatus;
  revealIndex: number;
  /** The block currently on the reveal walk, in display order — array position is compared against revealIndex. */
  revealQuestions: BlockRevealQuestionView[];
}

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

/**
 * Whether the display has actually stepped to this question's position yet
 * — true once passed (position strictly before the current revealIndex, so
 * still true if the walk has since moved into a later round's intro card),
 * or currently showing it (position === revealIndex and status is the
 * per-question 'reveal' step, not the round's 'reveal_intro' title card).
 * Undefined position (not part of the block currently on the walk — either
 * an older, already-finished block, or not yet started) counts as shown:
 * an older block's walk necessarily finished before the game moved on.
 */
function isDisplayRevealed(
  questionId: number,
  activeReveal: ActiveRevealWalk | null,
): boolean {
  if (!activeReveal) return true;
  const position = activeReveal.revealQuestions.findIndex(
    (question) => question.id === questionId,
  );
  if (position === -1) return true;
  return (
    position < activeReveal.revealIndex ||
    (position === activeReveal.revealIndex && activeReveal.status === 'reveal')
  );
}

/** Every question the team has seen open so far, oldest round/position first, paired with the team's own answer (if any), the correct answer (once revealed), and points awarded plus verdict (shown once the display has actually stepped to that question — 0 for an unanswered question — even if the answer was actually graded earlier). Both come from the team's own synced graded answers, closest_guess included. */
export function buildOpenedQuestions(
  seenQuestions: Record<number, BlockQuestionView | BlockRevealQuestionView>,
  myAnswers: Record<number, string>,
  myAnswerGrades: Record<number, MyAnswerGrade> = {},
  activeReveal: ActiveRevealWalk | null = null,
): OpenedQuestionEntry[] {
  return Object.values(seenQuestions)
    .map((question) => {
      const myAnswer = myAnswers[question.id] ?? null;
      const revealed = isRevealed(question);
      const isShown = revealed && isDisplayRevealed(question.id, activeReveal);
      const grade = isShown ? myAnswerGrades[question.id] : undefined;
      const pointsAwarded = !isShown
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
