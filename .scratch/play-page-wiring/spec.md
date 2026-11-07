# Spec: the /play page as plain wiring

Status: ready-for-agent

Blocked by: `power-up-offer`, `coin-ledger`, `quiz-mode-module` (ticket 04), `doubled-rounds` (ticket 04)

Source: architecture review 2026-11-07, candidate 5 ("/play page: complexity-split helpers with hook-shaped interfaces"), rated Speculative. The review's advice was not to refactor this directly: the page shrinks once candidates 1, 2 and 4 move their rules into shared modules. This spec is the cleanup after those land, plus a check of whether any cleanup is still needed.

## Problem Statement

The phone's play page is the largest file in the frontend (about 730 lines, 16 functions). The split that brought every function under the CRAP limit of 10 kept the pieces in the page, and they talk to each other through whole hook results: a dozen props are typed as "whatever this hook returns", and the question browser takes 18 props. The helpers fail the deletion test. Inlining one moves its lines back into its caller and makes nothing simpler, because its interface is about as big as its body.

Most of that bulk is rules that belong elsewhere. Each is being moved by another spec:

- the power-ups card's props, including the "no question power-up in a quickfire round" decision → the Power-up offer (`power-up-offer`)
- "does this team see coins" for the shop and the status screens → the Coin ledger (`coin-ledger`)
- which rounds this team doubles, behind the joker marks and the "+N" joker extra → Doubled rounds (`doubled-rounds`)
- the quickfire flag the page passes the power-up offer → deleted by the Quiz mode (`quiz-mode-module` ticket 04); the per-round flag the question browser reads for engine behaviour stays

When those specs land, each helper that held a rule is left holding only a call into a shared module. If nobody tidies up after them, the page keeps the shape of the old split: helpers that pass hook results through, with no rule left in them.

Teams don't see this problem. Developers do: changing what the phone shows means tracing values through helpers that only pass them along, and the 26 page-level tests are the only thing that says what the page does.

## Solution

After the other four specs land, measure the page first. Then shape it so that each remaining piece either holds a phone-only rule with its own small interface, or is plain wiring inline in the component that renders it:

- helpers left as pure pass-through (the power-ups card's props, the side panels) are inlined at their call site, provided the CRAP limit still holds
- the phone-only derivations that remain (the joker marks for the title card and the selected question, the selected question's points, verdict and joker extra) move into the phone's existing joker-round module as plain functions of the view and the team's data, tested there
- components take the values they use instead of whole hook results, so their props say what they read

If the measurement shows the page is already plain wiring, close the spec as `wontfix` and record why. That's a valid outcome for a Speculative item.

Teams see no change.

## User Stories

1. As a team, I want my phone to behave exactly as before this cleanup (join, reconnect, answering, the question browser, the reveal, power-ups, coins, jokers, breaks, feedback), so that nothing I'm used to changes.
2. As a team, I want the joker marks on the round title card and on a question to keep appearing on exactly the rounds my team doubles, so that the cleanup doesn't move them.
3. As a team, I want the "+N" joker extra on a revealed answer unchanged, so that my double points still show.
4. As a team, I want the power-ups card and the coin count to appear and hide exactly when they do today, so that the shop is where I expect it.
5. As a team in a quickfire quiz, I want no power-ups or coins on my phone, as today.
6. As a developer changing what the phone shows, I want each piece of the play page to either hold one phone-only rule or be plain wiring, so that I find the logic I'm after in one place.
7. As a developer, I want components to declare the values they read instead of whole hook results, so that I can tell from a component's props what it depends on.
8. As a developer, I want no helper whose interface is as big as its body, so that every function on the page earns its place.
9. As a developer, I want the phone's joker derivations (joker title card, joker question, the selected question's result) tested as plain functions, so that I don't have to render the page to check them.
10. As a developer, I want every function on the play page to stay under the CRAP limit, so that the cleanup doesn't undo the split that got it there.
11. As a developer, I want the existing page-level tests to stay the regression net, unchanged, so that a behaviour change can't slip in disguised as a refactor.
12. As a developer, I want the spec closed as `wontfix` if the other specs already left the page as plain wiring, so that nobody refactors for its own sake.

## Implementation Decisions

- **Measure before cutting.** Once the blocking specs land, list the page's remaining helpers and give each a verdict: holds a phone-only rule (keep it or move it to a domain module), pure pass-through (inline it), or a component boundary (keep it, narrow its props). If no helper is pass-through and no prop is hook-shaped, close as `wontfix` with that list as the reason.
- **Inline what fails the deletion test.** The power-ups card's props helper and the side-panels helper are expected to become pure pass-through once the Power-up offer and the Coin ledger take their rules. Inline them where the panels render. If inlining puts a component over the CRAP limit, keep the helper and give it a narrow interface instead. The limit wins.
- **Phone-only derivations go to the existing joker-round module.** The joker marks (is the round title card a doubled round; is the selected question in one) and the selected question's result (points, verdict, joker extra) are plain functions of the player view, the team's joker and purchases, and the selected question. They move beside the doubled-rounds list and the joker-extra helper already in that module, taking plain inputs, and the page calls them.
- **Props say what they read.** Page components stop taking whole hook results (the question browser hook, the saved-confirmation hook, the power-up moment hook, the opened questions) and take the fields and callbacks they use. Where a group of values always travels together, one small named type is fine. A type that only renames a hook's return isn't.
- **The question browser's props:** narrow them only where the blocking specs collapsed several into one (for example, the doubled-rounds and joker-question values into one joker marks value). Its 18 props aren't a target in themselves.
- **No new files just to split the page.** Moving a component into its own file without simplifying it only relocates the lines. Do it only when a component gains a test of its own.
- **No behaviour, protocol or copy change.**

## Testing Decisions

- **The seam is the existing page-level tests.** 26 test files render the whole play page through the shared test utilities, with a mocked team link, and assert what a team sees and can do. They're the highest seam and already cover join, reconnect, answering, the browser, the reveal, power-ups, jokers, breaks and feedback. They must pass unchanged. A test that needs editing for anything but an import is a sign behaviour changed.
- **The moved joker derivations** get plain unit cases in the existing joker-round helpers test: title card on and off a doubled round, the selected question in and out of one, no selection, an ungraded selection, the joker extra on a doubled round with points, with zero points and off a doubled round.
- No new page-level tests: the review's "no page-level test today" is out of date, since the page tests cover the page's behaviour.
- Run `pnpm crap:changed` (it flags every function in a touched file, so the whole page counts) and `pnpm mutate:changed` on the joker-round module.

## Out of Scope

- Moving rules out of the page. The four blocking specs do that; this spec only tidies what they leave.
- Restructuring the question browser beyond the props the blocking specs collapse.
- The `/control` page and the big screen.
- Any visible change on the phone, and so no `/guide`, `DOCUMENTATION.md` or glossary change.

## Further Notes

- Blocked by four specs. It can't start until the Power-up offer, the Coin ledger, the Quiz mode's gate-deletion ticket and doubled-rounds' phone ticket are all done, because each of them edits this page.
- Commit scope: `frontend`.
- The review's counts (734 lines, 16 functions, 12 hook-shaped props, 18 browser props) were taken before the blocking specs. Recount at the measure step.
