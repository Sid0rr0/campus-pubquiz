# The Doubled rounds module owns "never doubled"

Status: ready-for-agent

Source: architecture review 2026-11-10, candidate 3 ("The Doubled rounds module owns 'never doubled'", rated "worth exploring").

## Problem Statement

A developer working on the Extra joker or on Live edit has to know about the "a round with a Clue question is never doubled" rule in more places than the rule's own module, which is where it should live:

- The **Power-up offer**'s extra-joker rule takes a `clueRoundIds` list. Every caller works that list out before calling: the server's extra-joker purchase filters the seeded rounds through `canBeDoubled`, and the phone's power-ups list maps the players view's `clueRounds` to ids. The offer's interface uses a Clue concept, but all it needs to know is whether the offered round can be doubled.
- **Live edit**'s Clue-on-doubled-round guard works out "the rounds some team doubles" with its own code: it builds a set from `session.jokers` and the extra-joker rows in `session.funFactData.powerUps`, without calling the **Doubled rounds** rule (`doubledRoundIds`). Right now the two give the same answer. But if the Doubled rounds rule changes (a new way to double a round, or a joker that no longer counts), Live edit would quietly keep the old rule. It would then let a Clue question onto a doubled round, or block a save it should allow.

Nothing is broken today. The cost is locality: anyone who changes the rule has to find three callers that each copy part of it.

## Solution

The Doubled rounds module answers both questions, and callers ask it rather than computing their own answer:

- The extra-joker rule in the Power-up offer learns whether the offered round can be doubled from the offered round itself (`canBeDoubled`, worked out once in the shared module that names the offered round). It no longer takes a list of Clue rounds. The server's purchase path and the phone's card stop building that list for the rule.
- Live edit gets the rounds teams double from the Doubled rounds module (a session-wide variant of `doubledRoundIdsOfTeam`), and drops its own set-building.

Teams, the quiz master and the moderator see no difference: the same refusals with the same wording, the same notes on the Extra joker card, and the same Live edit blocks.

## User Stories

1. As a developer changing the Extra joker, I want the offer's rule to ask the offered round whether it can be doubled, so that I don't have to pass a list of Clue rounds into the offer.
2. As a developer changing what makes a round undoublable (a new question type with clues, or any other reason), I want `canBeDoubled` to be the only place I edit, so that the joker pick, the extra joker's offer, its purchase refusal and the phone all follow the change.
3. As a developer changing what counts as a doubled round, I want Live edit to call the Doubled rounds module, so that the Clue-on-doubled guard can't drift away from scoring, the leaderboard and fun facts.
4. As a developer reading the Power-up offer, I want its input to describe the offered round (id, and whether it can be doubled), so that the offer's interface stays about power-ups and doesn't mention a question type.
5. As a developer writing a server purchase path, I want one shared function to tell me which round is on offer and whether it can be doubled, so that the server's refusal and the phone's card read the same answer.
6. As a team on a phone, I want the Extra joker card to keep showing "Can't be used on this round" when the next round has a Clue question, so that I know why I can't buy it.
7. As a team on a phone, I want the card to keep its "Can't be used on Round N…" note listing every Clue round, so that I can plan which round to save my coins for.
8. As a team, I want the server to keep refusing an extra joker for a round with a Clue question with "Can't be used on this round", even if my phone shows an old offer, so that the rule holds at the boundary.
9. As a team, I want the refusal order to stay as it is (not offered, wrong round, can't be doubled, already doubled, limit, coins), so that the reason I see is the same as before.
10. As a team, I want "That round is already doubled" to keep working for my joker round and for a round I already bought an extra joker for, so that I don't spend coins on a round that is already doubled.
11. As a quiz master doing a Live edit during a session, I want a save that adds a Clue question to a round any team doubles (its joker, held or chosen during the pick, or a bought extra joker) to stay blocked with the same message, so that no team ends up with a doubled Clue round.
12. As a quiz master doing a Live edit, I want a save that adds a Clue question to a round nobody doubles to keep going through, so that the guard doesn't block more than it should.
13. As a quiz master, I want a doubled round that both a joker and an extra joker sit on to be checked once, so that the guard doesn't report the same issue twice.
14. As a quiz master running several live sessions of one quiz, I want the guard to keep checking every session's doubled rounds, so that a doubled round in any session blocks the save.
15. As a developer, I want the session-wide doubled rounds covered by a pure test in `shared/types`, so that the union over teams is checked without Postgres.
16. As a developer, I want the players view's `extraJokerOffer` to say whether the offered round can be doubled, so that the phone doesn't have to cross-check it against `clueRounds`.
17. As a developer, I want `clueRounds` to stay in the players view only for the card's note, so that its one remaining job is obvious.

## Implementation Decisions

- **Doubled rounds module (shared/types)** stays the one home of the rule. It gains a session-wide variant next to `doubledRoundIdsOfTeam`: given a session's jokers and its purchase list (each with a `teamId`), it returns every round some team doubles, each once. It is defined as the union of `doubledRoundIdsOfTeam` over every team that holds a joker or a purchase, so it can't drift from the per-team rule. `canBeDoubled`, `playsJokers`, `doubledRoundIds` and `doubledRoundIdsOfTeam` keep their current interfaces.
- **The offered round** gets one shared builder that the server's purchase path and the players-view snapshot both use. It returns the round `extraJokerRoundId` picks as `{ roundId, roundNumber, canBeDoubled }`, or null. The snapshot adds the visible title on top, as it does now. `extraJokerRoundId` stays as it is; the builder calls it.
- **Players view payload**: `extraJokerOffer` gains `canBeDoubled: boolean`, giving `{ roundId, roundNumber, title, canBeDoubled } | null`. `clueRounds` stays unchanged, used only for the card's "Can't be used on …" note. This is an additive protocol change.
- **Power-up offer (shared/types)**: the extra joker's rule input drops `clueRoundIds` and `offeredRoundId`. It takes the offered round instead (`{ roundId, canBeDoubled } | null`; `OfferedRound` gains `canBeDoubled`). The rule:
  - not offered (max uses 0) → "That power-up is not offered"
  - requested round isn't the offered round, or nothing is offered → the "next round only" refusal (`WRONG_ROUND`)
  - offered round can't be doubled → "Can't be used on this round"
  - round already doubled by the team → "That round is already doubled"
  - limit reached → "You have reached the limit for that power-up"
  - too few coins → held back (`NOT_ENOUGH_COINS`)

  The order and wording don't change. `extraJokerPurchaseRefusal` takes the requested `roundId` and the offered round. `extraJokerOfferEntry` takes the offered round as it does now (an `OfferedRound`, which now carries `canBeDoubled`).
- **Server extra-joker purchase (purchase-changes)** passes the offered round from the shared builder. It no longer filters rounds through `canBeDoubled` itself and no longer imports it.
- **Phone power-ups list** passes the players view's `extraJokerOffer` straight to the offer entry. Its "is the offered round a Clue round" check (which shows the refusal reason as a note) reads `offer.canBeDoubled` instead of searching `clueRounds`. The "Can't be used on Round N…" note keeps reading `clueRounds`.
- **Live edit service**: its doubled-round helper gets the round ids from the new session-wide function (over `session.jokers` and `session.funFactData.powerUps`, the same sources it reads now) and keeps only the mapping to `DoubledRoundQuestions` (question ids and Clue question ids). The guard (`findCluesOnDoubledRounds`) and its interface don't change.
- **Docs**: DOCUMENTATION.md's players-view row and the Extra joker section describe `extraJokerOffer` as `{ roundId, roundNumber, title, canBeDoubled }`. GLOSSARY.md doesn't change: no term changes meaning. The `/guide` page doesn't change: `/control` looks and works the same.

## Testing Decisions

- A good test checks behaviour through the module's public interface: which rounds count as doubled, which refusal a buy gets, what the card says. It doesn't check how the module gets there, and it doesn't assert that a helper was called.
- Seams, highest first, all already in place. No new seam is added.
  1. **Doubled rounds module**, pure tests in `shared/types` (prior art: `doubled-rounds.test.ts`). New cases for the session-wide function: empty session; a joker only; an extra joker only; a joker and an extra joker on the same round (counted once); two teams doubling different rounds (union); a purchase that isn't an extra joker (ignored).
  2. **Power-up offer**, pure tests in `shared/types` (prior art: `power-up-offer.test.ts`, the table tests for `extraJokerPurchaseRefusal` and `extraJokerOfferEntry`). Swap the `clueRoundIds: [5]` cases for an offered round with `canBeDoubled: false`. Keep every refusal row and the refusal order, including the case where a wrong round beats a Clue round.
  3. **Players-view snapshot** (prior art: `session-snapshot.test.ts`): `extraJokerOffer.canBeDoubled` is false when the offered round has a Clue question and true otherwise. `clueRounds` doesn't change.
  4. **Server purchase**, DB-backed (prior art: the backend's `extra-joker.spec.ts`): buying for a Clue round still gets "Can't be used on this round". Its existing cases should pass without edits.
  5. **Live edit**, DB-backed (prior art: the backend's `extra-joker-live-edit.spec.ts` and the guard's `live-edit-guard.spec.ts`): adding a Clue question to a round doubled by a joker, or by an extra joker, is still blocked, and to an undoubled round still saves. These should pass without edits. They are the regression net for swapping in the module call.
  6. **Phone card** (prior art: the frontend's `extra-joker-offer.test.tsx`): the "Can't be used on this round" note and the "Can't be used on Round N" note still render. Fixtures gain `canBeDoubled` on `extraJokerOffer`.
- Fixtures that build `extraJokerOffer` or `OfferedRound` (shared, backend, frontend, e2e if any) gain the new field. Typecheck will find them.
- Run `pnpm crap:changed` before committing, and `pnpm mutate:changed` for the shared-types slice. Survivors in the new session-wide function or the offer's Clue branch mean a test is missing.

## Out of Scope

- Removing or renaming `clueRounds` in the players view. It still feeds the card's note. Folding the note into the offer is a separate change.
- Making the joker pick (`joker-changes`, `joker.ts`, `session-snapshot`'s pickable rounds) go through a new interface. They already call `canBeDoubled` directly, which is what this spec asks for.
- The SQL form of the Doubled rounds rule in standings (`doubled-rounds-query`) and its parity test. Nothing changes there.
- Changing which rounds can be doubled, or any wording a team or the quiz master sees.
- Candidates 1, 2, 4 and 5 of the same architecture review (Clue answer module, Grading policy's graded-as question, one record per team answer, display view adapters).

## Further Notes

- The review rated this candidate "worth exploring", not "strong": the payoff is locality and less duplication, and it fixes no current bug. Keep the change small.
- The Live edit set and `doubledRoundIdsOfTeam` read the same sources today (`session.jokers` and `funFactData.powerUps`, which carries `teamId`), so the swap shouldn't change behaviour. If a Live edit spec fails after the swap, the two rules had already drifted apart. Stop and report it rather than adjusting the test.
- Under the commit convention this is likely a `refactor(shared-types)` commit plus `refactor(backend)` and `refactor(frontend)` commits, or one `refactor(repo)` if it lands as a single commit.
