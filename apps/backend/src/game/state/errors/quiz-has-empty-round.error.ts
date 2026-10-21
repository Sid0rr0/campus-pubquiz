/** Thrown when a live session is asked for on a quiz that has a round with no questions. Advance could never get through such a round. */
export class QuizHasEmptyRoundError extends Error {
  constructor(roundNumber: number, roundTitle: string) {
    super(
      `Cannot start a session: Round ${roundNumber} "${roundTitle}" has no questions`,
    );
    this.name = 'QuizHasEmptyRoundError';
  }
}
