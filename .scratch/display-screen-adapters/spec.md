# Spec: Big-screen screens draw their Display screen directly

Status: ready-for-agent

Source: architecture review 2026-11-10, candidate 5 ("Collapse the big-screen view adapters", rated "speculative").

## Problem Statement

The big screen (`/display`) and the quiz preview both draw a **Display screen** through one Display screen view. It has a table with one entry per screen kind. For seven kinds, the entry is a pass-through adapter: a small view that only copies fields off the screen, the quiz preview context and the live context onto a screen component's own props, which repeat those same fields under the same names. The seven kinds are lobby, join overlay, round overview, ended, break intro, break review and the open question.

Every big-screen change to those screens therefore crosses two hops and three type declarations:
- the Display screen field;
- the adapter's copy of it;
- the screen component's prop.

Adding a field to a break intro means editing the adapter and the screen's props interface for no behavioural reason. The adapters are left over from splitting the view to pass the CRAP gate. They hold no decisions.

## Solution

Each of those seven big-screen screens takes the props the Display screen view already hands every screen: the typed screen of its kind, the quiz preview context, the live context (absent in a preview), the live media flags and whether the big screen is connected. Each one reads what it needs. The table points at the screens directly, and the seven adapters and the screens' duplicate prop interfaces are deleted.

The big screen and the quiz preview look and behave exactly as before.

The adapters that do real work stay:
- the leaderboard, rules, showdown and locking views, which add the big screen's layout around a component;
- the round title, break round title and reveal intro views, which build the card's label;
- joker pick, which feeds a component the phone also draws;
- the reveal, which branches on the reveal kind.

Shared components never learn the Display screen's shape.

## User Stories

1. As a quiz master, I want the big screen to look and behave exactly as before on every screen kind, so that nothing changes during a quiz night.
2. As a quiz author, I want the quiz preview to draw every screen as before, including screens that draw nothing without a live session (lobby, join overlay), so that previewing a quiz still works.
3. As a team in the room, I want the open question's "answered" count, quickfire countdown and media to behave as before, so that the refactor is invisible.
4. As a team in the room, I want the break intro's round, break number, bonus list, feedback prompt and fun facts to show as before, so that the break is unchanged.
5. As a team in the room, I want the break review's question and media to play as before, so that the review is unchanged.
6. As a developer adding a field to a Display screen kind, I want to edit only the shared screen type and the screen that draws it, so that a new field crosses one hop instead of three.
7. As a developer reading the big screen, I want one place per screen kind that turns its Display screen into pixels, so that I don't follow a field through an adapter whose only job is renaming.
8. As a developer, I want each of the seven screens typed against its own Display screen kind, so that typecheck shows exactly which fields it reads.
9. As a developer, I want screens shared with other pages (the leaderboard, the rules, joker pick, closest-guess reveals, the question display) left on their own props, so that the phone and the rules page don't depend on the big screen's types.
10. As a developer, I want the adapters that build labels or add layout kept, so that the only views deleted are ones that do nothing.
11. As a developer, I want the screen-kind table still checked exhaustively by typecheck, so that a new Display screen kind still fails to build until it has a screen.
12. As a developer running the CRAP report, I want every merged screen to stay at or under the CRAP limit, so that the split this undoes doesn't come back as a gate failure.
13. As a developer writing a big-screen test, I want to render a screen through the Display screen view with a Display screen fixture, so that tests use the same input the big screen does.

## Implementation Decisions

- **Collapsed (adapter deleted, screen takes the shared screen-view props):** lobby, join overlay, round overview, ended, break intro, break review, open question. Each is drawn only by the big screen and the quiz preview, through the Display screen view, and its adapter only copies fields.
- **Kept as they are:**
  - the leaderboard, rules, showdown and locking views (layout wrappers);
  - the round title, break round title and reveal intro views (label building over one shared title card);
  - joker pick (its component is also drawn on the phone);
  - the reveal (branches on the reveal kind and draws shared closest-guess and question components);
  - blank.
- **The shared screen-view props** (the screen of a kind plus the quiz preview context, its settings and quiz structure, the live context, the live media flags and the connected flag) are exported from the Display screen view and imported by each collapsed screen as a type-only import. A type-only import back into the view is erased at build, so it adds no runtime cycle. Its shape is unchanged.
- **Behaviour the adapters carried moves into the screen unchanged:**
  - lobby and join overlay draw nothing without a live context;
  - ended falls back to an empty leaderboard;
  - the open question's answered count is present only with a live context;
  - break intro shows the bonus list unless it is the final break.
- **Each collapsed screen's own props interface is deleted.** Its sub-components keep their own props.
- **The screen-kind table** keeps its mapped type over every Display screen kind, so exhaustiveness still holds. Collapsed kinds point straight at their screen.
- **Unchanged:** the Display screen type, the projection that builds it on the server, the socket payloads, and the `/display` and quiz preview pages.
- No `DOCUMENTATION.md`, `GLOSSARY.md` or `/guide` change: nothing a moderator or player sees changes.

## Testing Decisions

- **A good test renders a Display screen and asserts what the room sees** (text, counts, media test ids, what's absent). It doesn't check which component received which prop.
- **One seam: the Display screen view**, rendered with a Display screen fixture, with and without a live context. Its existing Vitest suite already covers several of these kinds without a live context (round overview, open question, break intro) and must pass unchanged.
- **Tests that render a collapsed screen directly** with its old props move to rendering through the Display screen view: the break fun-facts test and the hidden-video tests for the open question and break review. Their assertions stay the same; only the setup changes to a Display screen fixture. Reuse the fixture builders the Display screen view test already has rather than adding new ones.
- **Add a live-context case** for each collapsed kind not yet covered with one (lobby, join overlay, ended, open question with its answered count), plus a no-live case showing lobby and join overlay draw nothing. These pin the moved fallbacks.
- **Screens left on their own props** keep their existing tests untouched.
- **Run `pnpm crap:changed` before committing.** The review warns the merged screens must stay at or under 10. If one goes over, extract a sub-component that takes plain props inside that screen's file rather than bringing an adapter back.

## Out of Scope

- Collapsing the adapters listed as kept, or changing shared components to take Display screen types.
- Changing the Display screen type or its server-side projection.
- Merging the three round-title-card views into one.
- Any visual or behavioural change to the big screen or the quiz preview.
- Review candidates 1–4 (candidates 1–3 have their own specs).

## Further Notes

- The review rated this "speculative". The gain is deleting seven adapters and seven duplicate props interfaces, around 150 lines, plus one hop per screen. The behaviour moved is small: four fallbacks, each pinned by a test above. If the CRAP gate forces sub-components back into a screen, the net deletion shrinks; that's acceptable, since the gate is the constraint that matters.
- The review's "×7 screens" counts the same seven kinds this spec collapses.
- No overlap with the other open specs: grading-policy-graded-as and clue-answer-module touch the answer module and the phone, and doubled-rounds-owns-never-doubled touches the power-up offer and live edit.
