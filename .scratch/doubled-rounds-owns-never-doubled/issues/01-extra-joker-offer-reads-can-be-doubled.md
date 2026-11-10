# 01: The Extra joker offer reads `canBeDoubled` from the offered round

**What to build:** The extra joker's part of the **Power-up offer** stops taking a list of Clue rounds. It reads whether the offered round can be doubled from the offered round itself. One shared builder works out the offered round as `{ roundId, roundNumber, canBeDoubled }` from `extraJokerRoundId` and `canBeDoubled`. Put the builder next to `extraJokerRoundId`, not in the Doubled rounds module, because ticket 02 edits that module.

Both the players-view snapshot and the server's extra-joker purchase use the builder. The players view's `extraJokerOffer` gains `canBeDoubled`. The offer's extra-joker rule replaces `clueRoundIds` and `offeredRoundId` with the offered round (`{ roundId, canBeDoubled } | null`; `OfferedRound` gains `canBeDoubled`). The phone's Extra joker card passes `extraJokerOffer` straight through, and its "offered round is a Clue round" check reads `canBeDoubled`.

Teams see no difference: the same refusals, in the same order, with the same wording, and the same card notes. See the spec's Implementation Decisions for the refusal order.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The offer's extra-joker rule input no longer has `clueRoundIds` or `offeredRoundId`. The server's purchase path and the phone's power-ups list no longer build a list of Clue rounds for the rule.
- [ ] One shared builder returns the offered round with `canBeDoubled`. The snapshot and the server's purchase path both call it.
- [ ] The players view's `extraJokerOffer` is `{ roundId, roundNumber, title, canBeDoubled } | null`. `clueRounds` is unchanged and still feeds the card's "Can't be used on Round N…" note.
- [ ] `power-up-offer.test.ts` covers every extra-joker refusal and the refusal order, with an offered round that can't be doubled in place of `clueRoundIds`. A wrong round still beats a Clue round.
- [ ] `session-snapshot.test.ts`: `extraJokerOffer.canBeDoubled` is false when the offered round has a Clue question and true otherwise.
- [ ] The backend's existing extra-joker spec still passes, including "Can't be used on this round" for a Clue round.
- [ ] The phone's extra-joker offer test still shows both notes. Fixtures gain `canBeDoubled`.
- [ ] DOCUMENTATION.md describes `extraJokerOffer` with `canBeDoubled`, in both the players-view row and the Extra joker section.
- [ ] `pnpm typecheck`, the affected tests and `pnpm crap:changed` pass.
