# Spec: One Answer list module for /control and /remote

Status: ready-for-agent

Source: architecture review 2026-11-21, candidate 2 ("A Graded question's answers module for /control and /remote").

## Problem Statement

The quiz master grades from `/control`: they pick a question in the question browser, and the answers panel lists every team's answer to it, with the grade, updating live as teams answer and as grades change. The presenter remote (`/remote`) shows "N correct" in its status bar.

Behind both, the answers to one question come from two sources: a REST read when a question is picked, and a live answers broadcast from the server after each answer submit, grade or key fix. These are stitched together in pieces spread across three places:

- The admin game hook holds a single "live answers" slot for whichever question last arrived. It filters broadcasts through a "focused question", which the page has to set, and it exposes a setter so the page can push the REST read into the same slot.
- The control page has its own hook with three effects: one copies the REST read into the slot, one sets the focus, and one reloads after a reconnect.
- Even after all that, both readers (the answers panel and the question detail) still check that the slot holds the question they show, because it sometimes doesn't. When it doesn't, the answers panel disappears until something refreshes it.

Each piece only works if the others are wired correctly. The comments explain the bugs that each one patched. A REST read that comes back after a newer broadcast overwrites the newer answers with older ones.

`/remote` uses the same hook but gets none of the rest: no REST read, no focus, no reload after a reconnect. Its "N correct" counts whichever question last had a broadcast. That may not be the question on air, it's blank until someone answers, and it's stale after a reconnect.

## Solution

One **Answer list** module: given a session and a question, it returns that question's Answer list (the question plus every team's answer and grade), and keeps it current. It owns the REST read, the live broadcasts, keeping other questions' broadcasts apart, the reload after a reconnect, and the order between a read and a broadcast. A reader asks for a question's Answer list and gets that question's list or nothing, never another question's.

`/control` asks for the question picked in the question browser. `/remote` asks for the question on air, so its "N correct" is about the question the room is looking at, shows as soon as the remote opens, and comes back right after a reconnect.

For the quiz master, nothing changes on `/control` except that the answers panel no longer drops out or shows older answers after a race. On `/remote`, the "N correct" figure now refers to the question on air.

## User Stories

1. As a quiz master, I want the answers panel to show the picked question's answers as soon as I pick it, so that I can start grading straight away.
2. As a quiz master, I want the answers panel to update live as teams answer the picked question, so that I don't have to re-pick it.
3. As a quiz master, I want the answers panel to update when a grade changes, whether I made it or another staff member did, so that what I see is current.
4. As a quiz master, I want a live answer-key fix to update the answers panel's grades, so that I see the re-scored answers.
5. As a quiz master browsing an earlier question to grade it, I don't want teams answering the open question to replace or hide my answers panel, so that I can keep grading.
6. As a quiz master switching quickly between questions, I want the panel to show only the question I picked last, so that I never grade an answer against the wrong question.
7. As a quiz master, I don't want an older read finishing late to overwrite answers that arrived live after it, so that I never see a grade go backwards.
8. As a quiz master whose laptop lost Wi-Fi mid-grading, I want the answers panel to reload once I'm reconnected, so that I see the answers given while I was offline.
9. As a quiz master, I want a toast when the answers can't be loaded, so that I know the panel is incomplete (as today).
10. As a quiz master, I want the question detail to show the picked question's type and key from its Answer list when it has one, and from the snapshot otherwise, so that the detail always shows something (as today).
11. As a quiz master, I want picking a round title card or break card to show no answers panel, so that the screen stays about the card (as today).
12. As a quiz master switching to another session, I don't want the previous session's answers to flash up, so that I don't grade the wrong night.
13. As a presenter using the remote, I want "N correct" to count the answers to the question on air, so that I can tell the room how it went.
14. As a presenter, I want "N correct" to show as soon as I open the remote on a question that already has answers, so that I don't have to wait for the next answer.
15. As a presenter whose phone reconnected, I want "N correct" to be right again straight away, so that I don't read out a stale count.
16. As a presenter, I want "N correct" to disappear when no question is on air (title cards, breaks, the leaderboard), so that it never shows a count for a screen without a question.
17. As a presenter, I don't want teams answering another question to change "N correct", so that the count matches what's on the big screen.
18. As a moderator, I want the same answers and grades on `/control` and `/remote`, so that two staff members never disagree about a count.
19. As a developer, I want one interface ("give me this question's Answer list"), so that a new screen showing answers can't miss the read, the filter or the reconnect reload.
20. As a developer, I want the admin game hook to stop exposing a setter and a focus call just so the answers can work, so that its interface is about the session.
21. As a developer, I want the Answer list module tested once through its interface with the fake socket, so that the race, filtering and reconnect rules are pinned in one place.
22. As a developer writing a control or remote page test, I want to give the page an Answer list for a question, not stub three hook members, so that page tests stay about the page.
23. As a developer, I want readers not to re-check that the answers belong to their question, so that a forgotten check can't show the wrong question's answers.

## Implementation Decisions

### The Answer list module

- A new frontend module, the **Answer list** hook. It takes the session's join code and a question id (or none). It returns that question's Answer list (the existing answers payload: the question plus every team's answer and grade), or nothing while there's no question, while the first read is loading, or after a failed read.
- It returns only the Answer list of the question it was given. Readers don't check the question id.
- Its data lives in the shared query cache under the per-question answers key the REST read already uses. The REST read fills that entry, and each live answers broadcast writes the broadcast question's entry. Nothing is kept for questions no reader is showing (the cache entry is dropped once unobserved, as today).
- **Order between a read and a broadcast:** a broadcast that arrives while that question's read is in flight wins. The in-flight read is cancelled or its result discarded, so a late read never overwrites newer answers.
- **Reconnect:** after the admin socket reconnects, the answers entries are re-read. The server's resend on reconnect doesn't include answers.
- **Session change:** entries are keyed by join code, so another session's answers never show.
- A failed read shows the existing "Could not load answers" toast.

### The admin game hook

- It no longer holds an answers slot, and its interface loses the live answers, the setter and the focus call.
- Its answers broadcast listener writes each broadcast into that question's Answer list entry in the shared query cache. It's the only place the broadcast is received.
- Its reconnect timestamp stays, since other REST reads use it.

### Readers

- `/control` asks the Answer list module for the question picked in the question browser. The answers panel and the question detail receive that Answer list. Their "is this my question" checks, and the control page's own load/focus/reconnect hook, are deleted.
- `/remote` asks the Answer list module for the question on air (the snapshot's current question, or none). Its status bar shows "N correct" from that Answer list, and nothing when there's no question on air or no list yet.
- The REST read is the existing answers endpoint, which any signed-in staff member may call, so `/remote` needs no backend change.

### Docs

- `GLOSSARY.md`: add **Answer list**: one question's answers from every team with their grades, as staff see them on `/control` and `/remote`. It's read when a question is picked and kept current by the live answers broadcast. (Find a place for it near **Grading**.)
- `DOCUMENTATION.md`: say that the remote's "N correct" counts the question on air, if the remote section describes that figure.
- The `/guide` page: if it describes the remote's "N correct", say it counts the question on air. Nothing changes in how the moderator grades on `/control`.
- No backend or protocol change.

## Testing Decisions

Good tests here assert what a reader gets back for a question, and what the page shows, given what the server sends (REST reads and socket broadcasts). They don't assert how the module uses the query cache or which effect does what.

- **The Answer list module, through its hook interface**, with the existing fake socket and a real query client, and the answers REST read stubbed. This is the one seam that pins the rules:
  - the read fills the list;
  - a broadcast for that question updates it;
  - a broadcast for another question leaves it alone;
  - switching question returns the new question's list, never the old one's;
  - a broadcast arriving while the read is in flight isn't overwritten by the read;
  - a reconnect re-reads;
  - a session change shows no answers from the previous session;
  - no question returns nothing and reads nothing;
  - a failed read toasts.

  Prior art: the admin game hook's tests (its live answers cases move here) and the other hooks tested against the fake socket.
- **Page tests** (`/control` grading and question detail tests, the `/remote` page test): they keep mocking the admin session as today. They give the page an Answer list through the Answer list module's interface (or the stubbed REST read) instead of stubbing the live answers, setter and focus members. New `/remote` cases: "N correct" counts the question on air; it's hidden with no question on air; a broadcast for another question doesn't change it. Prior art: the grading live answers, grading question browsing and remote page tests.
- The admin game hook's tests drop their focus and setter cases and keep one case: an answers broadcast reaches the Answer list of its question.
- Run `pnpm crap:changed` before closing, plus the frontend mutation run on the Answer list module.

## Out of Scope

- The other candidates from the 2026-11-21 review (the phone's team view is [team-view-held-once](../team-view-held-once/spec.md); the Live results cache is [scoring-records](../scoring-records/spec.md); round identity across a live edit, the Bonus award policy, and the selected-question projection on the phone).
- Any backend change: the answers broadcast, its admin room, and the REST endpoint stay as they are.
- Reducing the control tests' other mocks (auth, navigation, quiz reads). Only the answers members change.
- Grading actions themselves (grade answer and quick point buttons). They keep going through the admin game hook.
- Showing more than "N correct" on `/remote`.

## Further Notes

- Today, a broadcast for the open question while the quiz master browses another question gets filtered out and lost. With the cache keyed by question, it's dropped only if no one is showing that question, and re-read when someone picks it. So nothing is lost either way.
- The race between the read and the broadcast exists today too (the REST read's effect copies into the slot whenever the data arrives). This spec fixes it rather than keeping it.
- `/remote` now makes one REST read per question on air, which is negligible at pub-quiz scale.

- The user confirmed the test seams above (2026-11-22): the Answer list hook through its interface, plus the existing page tests.
