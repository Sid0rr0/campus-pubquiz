# Spec: One pure function decides which question a team's phone shows

Status: ready-for-agent

Blocked by: None. Independent of the other features. `/play`'s inline "break or reveal" status chain is replaced by session-settle ticket 01 (named status groups); that edit is a different line from the ones this spec touches.

## Problem Statement

A team's phone shows one question at a time, and which one is decided by a stack of rules written inline in the `/play` page component (`apps/frontend/app/play/page.tsx`), spread across render-time state adjustments and the render body:

- **Follow the big screen.** By default the phone shows the block's newest opened question, not the question the display is literally on (stepping the display back with Previous mustn't drag the phone back). During reveal it follows the question the big screen is revealing instead.
- **Snap back.** Whenever the quiz master opens a new question or steps through the reveal, a phone that has been browsing returns to following, unless the team turned auto-advance off.
- **Browse.** A team can tap any opened question in the block and the phone stays on it.
- **Auto-advance off.** The view freezes on whatever is showing. If the frozen question stops existing (a new block replaced the old one) the phone re-pins to what the rules now resolve to.
- **Step.** In manual mode, previous/next move within the block's opened questions, with back/forward availability.

These rules interleave a remembered browsed id, two remembered "previous" values used to detect change, the auto-advance setting and the server's view. They can only be exercised by rendering the whole page with a mocked socket, so each rule is covered, if at all, by a page-level test that also sets up the join flow. The precedence among them (browsed, then reveal-on-screen, then newest, then current) exists only as a chain of `??` in the middle of a 489-line component.

The team-identity side of the same area (kick, session closed and logout each resetting state slightly differently, plus the restart re-join effect in `/play`) was considered and deliberately left alone: the differences are intentional (a kick wipes the stored name and team code; logout and session-closed keep them), so a reducer would mostly restate them. See Out of Scope.

## Solution

A pure module decides which question the phone shows. It takes the phone's view of the block (the opened questions, the current question, the question the big screen is revealing), what the team has browsed to, and the auto-advance setting, and returns the question to show, the browsed pick to remember next, and the previous/next neighbours. The `/play` page keeps only the remembered browsed pick (and whatever the module needs remembered between renders) and the handlers that set it.

Nothing changes on the phone: every rule above behaves as today, and no socket or storage contract changes.

## User Stories

1. As a team, I want my phone to show the newest opened question by default, so that I'm always answering what's live.
2. As a team, I want stepping the big screen back with Previous to leave my phone on the question I'm answering, as today.
3. As a team, I want my phone to follow the big screen's question through the reveal, as today.
4. As a team, I want to tap an opened question and stay on it while I think, as today.
5. As a team, I want my phone to snap back to the newest question when the quiz master opens one, unless I've turned auto-advance off.
6. As a team with auto-advance off, I want my view to stay put when new questions open, and to use Previous/Next to move through the block.
7. As a team with auto-advance off, I want my view to recover sensibly (onto the question the rules now resolve to) when a new block replaces the one I was on, instead of showing nothing.
8. As a team, I want turning auto-advance back on to take me to the newest question at once, as today.
9. As a developer, I want the precedence among browsed / revealing / newest / current written once, so that adding a rule is one edit.
10. As a developer, I want to test those rules directly against plain data, without mounting the page or mocking a socket.

## Implementation Decisions

- **New module: phone question selection,** pure, in the frontend (the rules are about one phone's browsing, which the server doesn't know). It sits next to the existing question-picker helpers in `apps/frontend/app/play/`.
- **What it decides.** Responsibilities are fixed; the exact signature is the implementer's call so long as the page holds no selection rule itself:
  - **Which question to show:** the browsed question if it is still in the block; else the question the big screen is revealing; else the block's last opened question; else the current question; else none.
  - **Snap back:** when the current question changes or the reveal step changes and auto-advance is on, the browsed pick is cleared.
  - **Re-pin:** with auto-advance off, a shown question that isn't the browsed pick becomes the browsed pick (covers both "just turned auto-advance off" and "the pin stopped resolving").
  - **Neighbours:** the previous and next opened question within the block, which also give back/forward availability.
- **What `/play` keeps:** the browsed id, the auto-advance setting and its storage, and the click handlers (`onSelectQuestion`, previous, next, toggle). It remembers whatever the module needs to detect change between renders (today: the previous current-question id and reveal step) and passes it in.
- **Immutability:** the module returns new values and never mutates its input.
- The page's remaining derived values (`revealQuestion`, `selectedQuestionPoints`, `jumpableQuestionIds`, `showBlockBrowser`) keep reading the selected question the module returns. They aren't selection rules.
- Behaviour is carried over exactly, including today's precedence and its edge cases (for example, the browsed id wins over the reveal-on-screen question).

## Testing Decisions

- **A good test states a scenario in plain data and asserts the question shown and the browsed pick afterwards.** It never asserts on rendering.
- **Seam 1: a table test on the pure module.** One row per scenario:
  - default follow with and without a current question
  - stepping the display back leaves the phone on the newest
  - reveal follows the on-screen question; browsed beats reveal
  - snap back on a new question and on a reveal step, with auto-advance on and off
  - browsed id no longer in the block
  - re-pin with auto-advance off, after turning it off and after a new block replaces the old
  - neighbours at the first, middle and last position, and with an empty block
- **Seam 2: the existing `/play` page tests pass unchanged.** `question-navigator`, `auto-advance-setting`, `question-visibility`, `break-and-reveal` and `answered-questions` already drive these behaviours through the page and are the proof the wiring didn't change anything.
- Prior art: `opened-questions.test.ts` and the question-picker helpers, which are already pure and tested against plain data.

## Out of Scope

- **Team identity (join, kick, session-closed, logout, and the lobby-restart re-join effect).** Deliberately left: the reset paths differ on purpose, and reconnect is a core feature, so a reducer over them is a riskier change for little deletion. Revisit only if a fourth reset path or a bug appears there.
- **Server-side changes.** The server already names the on-screen reveal question to the phone and hides what teams haven't been shown.
- **Changing any selection behaviour.** This is a move, not a redesign.
- **Named status groups** for `/play`'s review check. That's session-settle ticket 01.

## Further Notes

- The re-join effect in `/play` (restart into lobby triggers `joinTeam`) reaches into the join hook from outside it; that's worth remembering if identity is ever revisited.
