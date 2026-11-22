# Spec: The selected question as the team sees it

Status: done

Blocked by: team-view-held-once. This spec reads the team's data from the one **team view** the phone holds once that spec lands. Built before it, this would project from the copied team fields that spec deletes.

Source: architecture review 2026-11-21, candidate 6 ("The selected question as the team sees it"). The review rated it speculative, worth doing only once candidate 1 has landed.

## Problem Statement

On `/play`, the **block** phone screen shows one question at a time in the question browser (picker, prompt, answer form, and through break and reveal, the team's result). Everything the browser shows about that question *for this team* is worked out on the play page, from about five sources, and then passed in piece by piece:

- **Points and verdict** come from searching the opened-questions list for the selected question.
- **Joker extra** comes from the team's joker extras, searched again.
- **The joker border** ("this question's round counts double") comes from searching the block's questions for the selected question's round, then the team's doubled rounds.
- **The team's answer and recorded clue** come from the answers map, which the browser searches itself.
- **The purchases**, whose effects (the 50/50's removed options, Pin one, the widened margin) show on the question, arrive as the team's whole purchase list and are filtered inside the browser.
- **"Answering now"** is worked out in the power-ups card's props: the selected question counts only on the `block` phone screen, in `answering` mode, while the view says answerable. The browser gets the mode and the answerable flag separately and makes the same decision again for its form.

The browser's interface has 19 props, close to the size of its implementation. A change to how the team sees a question (a new power-up effect, a new verdict colour, a joker rule) means finding which of these pieces carries it, on the page or in the browser, and the helpers that work it out (the selected-result, joker-marks and power-ups-list builders) each search the page's data again.

## Solution

One **selected question view**: a pure projection of the selected question for this team. Given the player view, the team view, the team's pending answers and the selected question, it returns everything the browser and the power-ups card need to know about that one question:

- the question itself;
- the team's answer and recorded clue;
- points, verdict and joker extra;
- whether it's in a doubled round;
- the team's purchases on it;
- whether it is the question being answered right now.

The play page builds it once and hands it to the question browser and the power-ups card. The browser keeps its picker and navigation inputs and its callbacks, but takes one view in place of the question-specific props. "Answering now" is decided in one place.

Teams see no difference: the same question, answer, result, joker border, power-up effects and buttons as today.

## User Stories

1. As a team, I want the selected question to show exactly what it shows today (prompt, media, answer form, our answer, our result), so that the refactor costs us nothing on a quiz night.
2. As a team, I want our answer and its points, verdict colour and joker "+N" to show on a graded question as today, so that we see how we did.
3. As a team, I want an ungraded question to show our answer without a result, as today, so that we aren't shown a verdict too early.
4. As a team, I want the joker border on a question in a round we double (joker or extra joker), as today, so that we know it counts double.
5. As a team, I want no joker border on a question in a round we don't double, so that the border means something.
6. As a team that bought a 50/50, I want the removed options gone on that question and only that question, as today, so that the power-up does what it says.
7. As a team that bought Pin one, I want the pinned answer shown on that question, as today, so that we can use it.
8. As a team that bought Wider margin, I want the widened margin shown on that question, as today, so that we know the range we're aiming for.
9. As a team that bought Ask the room, I want the room split shown on that question once it's ready, as today, so that the purchase pays off.
10. As a team on a Clue question, I want our answer to freeze once a new clue is shown, and to stay editable when blank or "I don't know", as today, so that the clue rule holds.
11. As a team, I want the power-ups card to offer question power-ups only for the question we are answering right now, as today, so that we never buy one for a locked or revealed question.
12. As a team browsing back to an earlier question during the block, I want the power-ups card not to offer power-ups for it unless it is still being answered, so that "answering now" means the same in the card and the form.
13. As a team whose phone isn't linked to a team yet, I want no answer form and no power-up buttons, as today, so that nothing can be submitted for nobody.
14. As a team whose answer is still waiting for the server, I want that pending answer shown on the selected question, as today, so that a slow network doesn't hide what we typed.
15. As a team on a quickfire round, I want tap-to-submit to behave as today, so that speed scoring still works.
16. As a team in the reveal, I want the revealed question to mark our answer as today, so that we see which items we got right.
17. As a quiz master, I want nothing to change on `/control`, `/display` or `/remote`, so that running the night is the same.
18. As a developer, I want everything about the selected question for this team worked out in one pure function, so that a new power-up effect or result rule has one obvious home.
19. As a developer, I want the question browser's interface to take one view instead of a dozen question-specific props, so that its interface is smaller than its implementation.
20. As a developer, I want "answering now" decided once, so that the form and the power-ups card can't disagree.
21. As a developer, I want the projection unit-testable without rendering the page, so that edge cases (no selection, ungraded, other round, purchase on another question) each get a small case.

## Implementation Decisions

### The selected question view

- A new **pure function in the play screen's frontend code**, next to the existing opened-questions and joker-round helpers. Inputs:
  - the player view (phone screen, block questions, answerable flag);
  - the team view (answers, joker extras, doubled rounds, purchases), or none while unlinked;
  - the team's pending answers;
  - the selected question.

  It returns a view, or nothing with no selection.
- What the view holds:
  - the selected question;
  - the team's answer text and recorded clue (pending answer first, as today);
  - points, verdict and joker extra (null until graded or outside a doubled round);
  - whether its round is doubled for the team;
  - the team's purchases on this question;
  - whether it is the question being answered now (block phone screen, answering mode, answerable).
- It replaces the selected-result builder and the selected-question half of the joker-marks builder. The title-card and header half of joker marks (doubled rounds for the header, the joker title card) stays where it is.
- The power-up effects (removed options, pin, widened margin, room split) are still computed by the existing shared-type helpers. The view only narrows the purchases they read to this question. Whether the view also carries the computed effects is the implementer's choice. The rule is that the browser no longer filters the team's purchases itself.

### The question browser

- It takes the selected question view instead of these props: selected question, team, the answers map (for the selected question), points, verdict, joker extra, joker-question flag, purchases, answerable.
- It keeps its picker inputs (picker rounds, slot total, doubled round numbers, the answered marks the picker shows), the phase mode, the reveal question, the quickfire flag, navigation and its callbacks.
- If the picker still needs the whole answers map for its answered marks, pass the picker that, not the whole team.
- Submitting no longer needs the whole team. The page binds the team id into the submit callback, and the browser calls it with the question and value.
- The browser's rendering, test ids and wording are unchanged.

### The power-ups card

- The power-ups list builder takes the view's "answering now" question instead of working it out from the phone screen, mode and answerable flag.
- Its other inputs (settings, coins, purchases, extra-joker offer, buy callbacks) are unchanged. Cutting its nine inputs further is not part of this spec.

### Docs

- No new domain term outside the play screen code, so `GLOSSARY.md` stays as it is. Name the function after the domain ("selected question", **team view**, **Phone screen**), and don't add a glossary entry unless review asks for one.
- No behaviour change, so `DOCUMENTATION.md` and `/guide` stay as they are.

## Testing Decisions

- Good tests render the play screen from a team link state and assert what a team sees and can press: the result line, the joker border, removed options, the pinned answer, the power-up buttons. They never assert on the browser's props or on which helper computed a value.
- **Behaviour seam (existing): the play page rendered with a mocked team link** (the play tests' team-link-result builder). The play tests for answers, the joker round and chip, power-ups, pinned answers, Clue questions, break and reveal, the reveal verdict card, quickfire and question navigation must pass unchanged, apart from fixture updates the team-view-held-once spec already made. Add one case if none exists: browsing back to a still-open earlier question shows the same power-up buttons in the card as the form's answerable state.
- **Unit seam (existing pattern): the projection as a pure function**, like the joker-round helpers and opened-questions unit tests. It covers no selection, unlinked, ungraded, graded with and without joker extra, a doubled and an undoubled round, purchases on another question excluded, a pending answer over a saved one, and "answering now" in each phone screen mode. The joker-round helper tests for the selected-result builder move here.
- Run `pnpm crap:changed` and fix what it flags. The play page's top-level component is touched.

## Out of Scope

- Anything the team-view-held-once spec does (one team view, removing the copied fields and patches).
- Reducing the power-ups list builder's other inputs, the status section or the bonus panel props.
- Moving the projection to shared types or the server (a server-side selected question would cost a round trip per selection).
- Any visible change on `/play`.
- Candidates 1–5 of the same architecture review.

## Further Notes

- The review rated this speculative. If, after team-view-held-once, the browser's props have already shrunk because the copied team fields are gone, check what's left before starting. If points, verdict, joker extra, joker flag and purchases are still separate props, the spec stands. If not, narrow it to deciding "answering now" once.
- I haven't read the browser's whole body or the answer form's props. The list of props that move into the view follows the browser's prop list and what it reads in its first 300 lines.
