/** Thrown by GameStateService.applyAction when ADVANCE would leave the break/grading screens for reveal while block questions still have ungraded answers. */
export class UngradedAnswersError extends Error {
  constructor(public readonly questionIds: number[]) {
    super(
      `Cannot reveal yet: ${questionIds.length} question(s) still have ungraded answers.`,
    );
    this.name = 'UngradedAnswersError';
  }
}
