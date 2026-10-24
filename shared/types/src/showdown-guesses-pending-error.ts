/** Thrown by GameStateService.applyAction when ADVANCE would leave the showdown's guessing step (step 0) while a participating team still hasn't submitted a guess. */
export class ShowdownGuessesPendingError extends Error {
  constructor() {
    // Stryker disable next-line StringLiteral: accepted, an error message is a constant (CODING_STANDARDS "Tests")
    super('Cannot reveal yet: not every team has submitted a guess.');
    // Stryker disable next-line StringLiteral: accepted, an error class name is a constant (CODING_STANDARDS "Tests")
    this.name = 'ShowdownGuessesPendingError';
  }
}
