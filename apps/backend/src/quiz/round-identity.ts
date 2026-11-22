/**
 * Round identity: across a live edit, a round is the round now holding most of
 * the questions it held. `before` is the question ids the round held; `after`
 * is each round of the edited quiz as its question ids (a newly added question
 * has no id yet and never counts). Returns the position in `after` of that
 * round: the first such round on a tie, or null when none of its questions is
 * left (including a round that held none).
 */
export function roundIdentity(
  before: readonly number[],
  after: readonly (readonly (number | undefined)[])[],
): number | null {
  const held = new Set(before);
  let best: { position: number; kept: number } | null = null;
  after.forEach((ids, position) => {
    const kept = ids.filter((id) => id !== undefined && held.has(id)).length;
    if (kept > 0 && (best === null || kept > best.kept)) {
      best = { position, kept };
    }
  });
  return (best as { position: number } | null)?.position ?? null;
}
