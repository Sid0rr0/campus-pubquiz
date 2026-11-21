# 01: The rating rows take server values, and the ratings counter goes

**What to build:** The round star rows (the break's round rating card and the final feedback form) and the session scale rows (the final form) take the server's saved value for every row that isn't waiting on a tap of its own, whenever the saved values they're given change. They no longer read the saved values only once at mount. The phone's ratings counter and the remount keys built on it are deleted. A grade, bonus award, live edit or Ask the room update arriving during the break no longer wipes a rating tap: a saving row keeps its tap and shows "Saved ✓" when the acknowledgement lands, and a failed row keeps its retry prompt. This follows the pattern the feedback comment box already uses. See the spec's "The rating rows take server values themselves".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A team view arriving while a round rating is saving keeps the tap; its "Saved ✓" appears once the acknowledgement lands
- [ ] A team view carrying a new saved rating fills an idle row
- [ ] A failed row keeps "Not saved — tap to retry" when an unrelated team view arrives
- [ ] The same three cases hold for the final form's star rows and pacing/felt-difficulty rows
- [ ] After a reconnect the card shows the join reply's ratings, and a tap left over from the old connection isn't shown as saved
- [ ] The ratings counter and every remount key built on it are gone
- [ ] Tested through the play screen's existing rating tests (rate-the-rounds, final form, final feedback comment topics)
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
