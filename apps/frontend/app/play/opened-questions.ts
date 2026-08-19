import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  GameStatus,
  QuestionType,
} from '@campus-pubquiz/types';
import type { MyAnswerGrade } from '@/app/lib/use-game-socket';

/** The current snapshot's reveal walk — lets points be gated to "shown on display yet", not just "block has started revealing". */
export interface ActiveRevealWalk {
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
}

function isRevealed(
  question: BlockQuestionView | BlockRevealQuestionView,
): question is BlockRevealQuestionView {
  return 'answer' in question;
}

/**
 * closest_guess is graded automatically in one batch (never through
 * GRADE_ANSWER), so it has no live per-team grade push — its own reveal data
 * already publicly lists every team tied for closest, so points are derived
 * from that instead of myAnswerGrades. Null only when nobody submitted a
 * guess at all (nothing was graded); a team that didn't submit still gets 0
 * once someone else's guess put a real grading result on the board.
 */
function resolveClosestGuessPoints(
  question: BlockRevealQuestionView,
  myTeamName: string | null,
): number | null {
  const summary = question.closestGuess;
  if (!summary?.hasSubmissions) return null;
  const wasClosest = summary.closestGuesses.some(
    (guess) => guess.teamName === myTeamName,
  );
  return wasClosest ? question.points : 0;
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

/** Every question the team has seen open so far, oldest round/position first, paired with the team's own answer (if any), the correct answer (once revealed), and points awarded (shown once the display has actually stepped to that question — 0 for an unanswered question — even if the answer was actually graded earlier). */
export function buildOpenedQuestions(
  seenQuestions: Record<number, BlockQuestionView | BlockRevealQuestionView>,
  myAnswers: Record<number, string>,
  myAnswerGrades: Record<number, MyAnswerGrade> = {},
  myTeamName: string | null = null,
  activeReveal: ActiveRevealWalk | null = null,
): OpenedQuestionEntry[] {
  return Object.values(seenQuestions)
    .map((question) => {
      const myAnswer = myAnswers[question.id] ?? null;
      const revealed = isRevealed(question);
      const pointsAwarded =
        !revealed || !isDisplayRevealed(question.id, activeReveal)
          ? null
          : question.type === 'closest_guess'
            ? resolveClosestGuessPoints(question, myTeamName)
            : (myAnswerGrades[question.id]?.pointsAwarded ??
              (myAnswer === null ? 0 : null));
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
      };
    })
    .sort((a, b) =>
      a.roundNumber !== b.roundNumber
        ? a.roundNumber - b.roundNumber
        : a.questionNumberInRound - b.questionNumberInRound,
    );
}
