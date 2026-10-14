# 01: The question type registry says how each type is revealed

Status: done

Spec: [One Closest-guess reveal module owns the reveal steps](../spec.md)

**What to build:** Each question type in the registry declares its Reveal kind, `answer` or `closest_guess`. Building the block's reveal questions and counting closest-guess reveal steps both read that field, and neither asks whether the type is batch-graded. Every reveal looks exactly as it does today.

- Add a Reveal kind field to the question type registry. Only closest_guess says `closest_guess`, and every other type says `answer`. The field is required, so a new type that leaves it out fails to type-check. It is its own field, never derived from the grading mode (the same reasoning as ADR 0001's kahoot-allowed field).
- Building the reveal questions for the block and for past blocks picks the Reveal kind from the registry field.
- The closest-guess step count decides "is this a closest-guess reveal" from the registry field.
- The closest-guess reveal no longer imports the batch-graded predicate. The answers panel keeps using it; that is out of scope.
- Extend the question-kind parity test: every type declares a Reveal kind, and only closest_guess is `closest_guess`.
- GLOSSARY.md: no change to the Reveal kind entry, which already says the registry decides it. Check that it still reads true.

## Acceptance criteria

- [ ] The registry has a required Reveal kind field; only closest_guess is `closest_guess`
- [ ] The reveal-question builder and the step count read it; neither calls the batch-graded predicate
- [ ] The parity test covers the field
- [ ] The existing closest-guess reveal, players-reveal redaction and past-revealed-questions specs pass unchanged
- [ ] `pnpm typecheck` and `pnpm test` pass
