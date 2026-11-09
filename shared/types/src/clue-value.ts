/** A Clue question carries 2-8 clues; each clue not yet shown is worth half a point. */
export const MIN_CLUES = 2;
export const MAX_CLUES = 8;
const CLUE_STEP = 0.5;

/** What a right answer is worth locked in on clue `clue` (1-based) of `clueCount`: half a point for every clue the room had not yet seen, counting this one. */
export function clueValue(clueCount: number, clue: number): number {
  return CLUE_STEP * (clueCount - clue + 1);
}

/** What a right answer locked in on clue `clue` is worth, from the question's points (its first-clue value) alone: for readers that don't hold the clues. */
export function clueValueFromPoints(points: number, clue: number): number {
  return points - CLUE_STEP * (clue - 1);
}

/** Every clue's value, first clue (the most) to last (half a point). */
export function clueValues(clueCount: number): number[] {
  return Array.from({ length: clueCount }, (_, index) =>
    clueValue(clueCount, index + 1),
  );
}

/** The points a Clue question stores: its first-clue value. */
export function cluePoints(clueCount: number): number {
  return clueValue(clueCount, 1);
}
