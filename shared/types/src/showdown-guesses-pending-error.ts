/** Thrown by GameStateService.applyAction when ADVANCE would leave the showdown's guessing step (step 0) while a participating team still hasn't submitted a guess. */
export class ShowdownGuessesPendingError extends Error {
  constructor() {
    super('Cannot reveal yet: not every team has submitted a guess.');
    this.name = 'ShowdownGuessesPendingError';
  }
}
