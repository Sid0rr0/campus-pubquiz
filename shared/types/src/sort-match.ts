/**
 * Shared pipe-separated-list helpers for the `sort` and `match` question
 * types. Both types encode their answer as a canonical `|`-joined string
 * (see socket-events.ts's QuestionType doc comment) — this is the one place
 * that string is split back into items, reused by CSV import, the manual
 * quiz editor, and every answer-formatting UI so the convention stays in
 * exactly one place.
 */
export function splitPipeList(raw: string): string[] {
  return raw
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** True if `a` and `b` contain exactly the same items, ignoring order. */
export function isSameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((item, index) => item === sortedB[index]);
}
