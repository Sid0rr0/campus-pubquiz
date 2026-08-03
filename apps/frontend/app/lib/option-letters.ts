// Base-26 index → letter (A, B, ... Z, AA, AB, ...) so any number of
// multiple-choice options gets a distinct label, not just the first 4.
export function getOptionLetter(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}
