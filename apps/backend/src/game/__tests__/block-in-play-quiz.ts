import type { RevealQuestionView, SeededRound } from '@campus-pubquiz/types';

/** A question whose id encodes its position: round 3, question 2 (zero-based) is 132. */
export function questionId(roundIndex: number, questionIndex: number): number {
  return 100 + roundIndex * 10 + questionIndex;
}

function round(
  roundIndex: number,
  overrides: Pick<SeededRound, 'breakAfter' | 'kahootMode'>,
): SeededRound {
  const questions: RevealQuestionView[] = [0, 1].map((questionIndex) => ({
    id: questionId(roundIndex, questionIndex),
    type: 'free_text',
    prompt: `Round ${roundIndex} question ${questionIndex}`,
    answer: 'answer',
    points: 1,
  }));
  return {
    id: roundIndex + 1,
    title: `Round ${roundIndex}`,
    questions,
    ...overrides,
  };
}

/**
 * Two blocks (rounds 0-1 are one block spanning two rounds; round 2 is the
 * second), a two-question kahoot round (each question its own block) and a
 * final round. Every round has two questions.
 */
export const BLOCK_IN_PLAY_ROUNDS: SeededRound[] = [
  round(0, { breakAfter: false }),
  round(1, { breakAfter: true }),
  round(2, { breakAfter: true }),
  round(3, { breakAfter: false, kahootMode: true }),
  round(4, { breakAfter: true }),
];
