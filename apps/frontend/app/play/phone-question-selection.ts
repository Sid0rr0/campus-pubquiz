export interface PhoneQuestionSelectionInput<Q extends { id: number }> {
  /** The block's opened questions, oldest first. */
  openedQuestions: readonly Q[];
  /** The question the display is literally on, if any. */
  currentQuestion: Q | null;
  /** The question the big screen is revealing, if any. */
  onScreenQuestionId: number | null;
  /** The question the team tapped, if any. */
  browsedQuestionId: number | null;
  autoAdvanceEnabled: boolean;
  /** Changes on every reveal step, null outside the reveal. */
  revealSyncKey: number | null;
  /** The current question id and reveal step as of the last render, to detect change. */
  previousCurrentQuestionId: number | null;
  previousRevealSyncKey: number | null;
}

export interface PhoneQuestionSelection<Q extends { id: number }> {
  selectedQuestion: Q | null;
  /** The opened question before the selected one, null at the first or if the selection isn't in the block. */
  previousQuestion: Q | null;
  /** The opened question after the selected one, null at the last or if the selection isn't in the block. */
  nextQuestion: Q | null;
  /** The browsed pick to remember for the next render. */
  browsedQuestionId: number | null;
}

/** Turning auto-advance on resumes following at once; turning it off keeps the pick. */
export function browsedQuestionAfterAutoAdvanceChange(
  autoAdvanceEnabled: boolean,
  browsedQuestionId: number | null,
): number | null {
  return autoAdvanceEnabled ? null : browsedQuestionId;
}

/**
 * Which question a team's phone shows: the browsed question if it is still in
 * the block, else the one the big screen is revealing, else the block's last
 * opened question (not currentQuestion, so stepping the display back doesn't
 * drag the phone back), else the current question, else none.
 *
 * Snap back: a new current question or reveal step clears the browsed pick
 * while auto-advance is on. Re-pin: with auto-advance off, the shown question
 * becomes the browsed pick, so the view holds still and recovers if the pin
 * stops resolving (a new block replaced it).
 */
export function selectPhoneQuestion<Q extends { id: number }>({
  openedQuestions,
  currentQuestion,
  onScreenQuestionId,
  browsedQuestionId,
  autoAdvanceEnabled,
  revealSyncKey,
  previousCurrentQuestionId,
  previousRevealSyncKey,
}: PhoneQuestionSelectionInput<Q>): PhoneQuestionSelection<Q> {
  const hasChanged =
    (currentQuestion?.id ?? null) !== previousCurrentQuestionId ||
    revealSyncKey !== previousRevealSyncKey;
  const followedBrowsedId =
    hasChanged && autoAdvanceEnabled ? null : browsedQuestionId;
  const selectedQuestion =
    openedQuestions.find((question) => question.id === followedBrowsedId) ??
    openedQuestions.find((question) => question.id === onScreenQuestionId) ??
    openedQuestions[openedQuestions.length - 1] ??
    currentQuestion ??
    null;
  const index = openedQuestions.findIndex(
    (question) => question.id === selectedQuestion?.id,
  );
  return {
    selectedQuestion,
    browsedQuestionId: autoAdvanceEnabled
      ? followedBrowsedId
      : (selectedQuestion?.id ?? followedBrowsedId),
    previousQuestion: index > 0 ? openedQuestions[index - 1] : null,
    nextQuestion:
      index !== -1 && index < openedQuestions.length - 1
        ? openedQuestions[index + 1]
        : null,
  };
}
