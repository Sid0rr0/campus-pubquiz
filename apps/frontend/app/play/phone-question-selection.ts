export interface PhoneQuestionSelectionInput<Q extends { id: number }> {
  /** The block's opened questions, oldest first. */
  openedQuestions: readonly Q[];
  /** The question the display is literally on, if any. */
  currentQuestion: Q | null;
  /** The question the big screen is revealing, if any. */
  onScreenQuestionId: number | null;
  /** The question the team tapped, if any. */
  browsedQuestionId: number | null;
}

export interface PhoneQuestionSelection<Q extends { id: number }> {
  selectedQuestion: Q | null;
  /** The opened question before the selected one, null at the first or if the selection isn't in the block. */
  previousQuestion: Q | null;
  /** The opened question after the selected one, null at the last or if the selection isn't in the block. */
  nextQuestion: Q | null;
}

/**
 * Which question a team's phone shows: the browsed question if it is still in
 * the block, else the one the big screen is revealing, else the block's last
 * opened question (not currentQuestion, so stepping the display back doesn't
 * drag the phone back), else the current question, else none.
 */
export function selectPhoneQuestion<Q extends { id: number }>({
  openedQuestions,
  currentQuestion,
  onScreenQuestionId,
  browsedQuestionId,
}: PhoneQuestionSelectionInput<Q>): PhoneQuestionSelection<Q> {
  const selectedQuestion =
    openedQuestions.find((question) => question.id === browsedQuestionId) ??
    openedQuestions.find((question) => question.id === onScreenQuestionId) ??
    openedQuestions[openedQuestions.length - 1] ??
    currentQuestion ??
    null;
  const index = openedQuestions.findIndex(
    (question) => question.id === selectedQuestion?.id,
  );
  return {
    selectedQuestion,
    previousQuestion: index > 0 ? openedQuestions[index - 1] : null,
    nextQuestion:
      index !== -1 && index < openedQuestions.length - 1
        ? openedQuestions[index + 1]
        : null,
  };
}
