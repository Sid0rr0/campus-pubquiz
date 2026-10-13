# Spec: Move phone question browsing out of /play, and narrow the Team link hook

Status: done

Source: architecture review 2026-10-13, candidate 06 ("Worth exploring", in-process with a localStorage adapter).

## Problem Statement

The /play page is the most-changed file on the frontend, and it does three jobs at once:

- **It owns the phone's question browsing.** Which question the block browser shows, the team's browsed pick, the auto-advance setting (read from localStorage after mount, written on change), the previous/next navigation, and the "snap back on a new question or reveal step" bookkeeping all live in the page as five pieces of state. Two of them are synced during render. The rule itself is already pure (phone question selection), but the state around it is spread through a 444-line component and can only be exercised by rendering the whole page.
- **It consumes a 25-field hook.** The Team link hook returns one flat bag: the join form's inputs and setters, the stored identity, the connection error, the snapshot, the team, the team's answers, grades, bonus awards, ratings and feedback, the seen questions, and five actions. Each consumer picks a different subset: the /play page, the home page's join panel and the player menu bridge. Nothing in the shape says which fields belong to "joining" and which to "playing a joined game", so the page has to default half of them (`myAnswers = {}` and so on).
- **The join gate is copied.** "Show the join form unless the team has a name, there is a session to reach, and no unrecovered connection error" is written once in /play and again in the home page's join panel, with a comment saying it mirrors the other.

For a developer this means:
- a change to how the phone browses questions means editing the page
- every /play test (15 files) fakes all 25 fields
- a change to the join gate has to be made twice

## Solution

- **A phone question browser hook** owns browsing on a team's phone. It takes the players view and returns what the block browser needs:
  - the selected question
  - its revealed version during the reveal
  - the previous/next navigation when auto-advance is off
  - which questions can be jumped to
  - a way to select a question
  - the auto-advance setting and its setter

  It reads and writes the auto-advance setting in localStorage and keeps the snap-back bookkeeping inside itself.
- **The Team link hook returns two parts instead of one flat bag:**
  - **Join:** who the team is and how it gets in. This covers the form inputs, joining and logging out, the stored identity, the connection error, the team, and whether the join form should be shown, with the gate defined once.
  - **Joined game:** what a joined phone plays with. This covers the players view, the team's answers, grades, bonus awards, ratings, feedback and seen questions, and the in-game actions. It is absent until a view has arrived.

Teams see no difference. Every screen, button, toast, setting and reconnect behaves exactly as it does today.

## User Stories

1. As a team, I want the block browser to keep showing the question the big screen is on, exactly as today, so that I always answer the right question.
2. As a team, I want my phone to jump to each new question as it opens while auto-advance is on, as today, so that I don't have to tap.
3. As a team, I want my phone to follow each reveal step while auto-advance is on, as today, so that I see my answer next to the one being revealed.
4. As a team, I want a question I tapped to stay selected until the next question or reveal step while auto-advance is on, as today, so that I can check an earlier answer briefly.
5. As a team, I want my selection to hold still with auto-advance off, as today, so that I can work through the block at my own pace.
6. As a team, I want previous/next buttons with auto-advance off, as today, so that I can step through the block's opened questions.
7. As a team, I want previous/next to be disabled at the ends of the block, as today, so that I can't step off it.
8. As a team, I want turning auto-advance back on to resume following straight away, as today, so that I catch up with the big screen.
9. As a team, I want turning auto-advance off to keep my current question, as today, so that the screen doesn't jump when I change the setting.
10. As a team, I want my auto-advance choice remembered on this phone, as today, so that I don't have to set it every quiz.
11. As a team, I want auto-advance on by default before my saved choice is read, as today, so that the first paint follows the big screen.
12. As a team, I want a new block to replace my pinned question when it no longer exists, as today, so that I'm never stuck on a stale question.
13. As a team, I want to see the correct answer next to mine for the selected question during the reveal, as today, so that I know how I did.
14. As a team, I want tapping a question in my answered history to jump to it only when it is in the current block, as today, so that I'm never sent to a question the browser can't show.
15. As a team, I want the block browser hidden when my phone screen isn't the block screen, as today, so that other screens aren't cluttered.
16. As a team, I want the join form shown exactly when it is today (no name, nothing to reconnect to, or an unrecovered connection error), so that I'm never stuck on "Connecting…".
17. As a team on the home page, I want the join panel to decide between the form, connecting and joined exactly as /play does, so that both entry points behave the same.
18. As a team, I want "Log out" and "Change team" to behave exactly as today, so that I can switch teams.
19. As a team, I want my answers, grades, bonus awards, ratings and feedback to appear exactly as today after a join or reconnect, so that nothing I did is lost.
20. As a team, I want the player menu in the header to show my team and log-out action as today, so that the mobile menu still works.
21. As a developer, I want the page to stop holding browsing state, so that /play only lays out screens.
22. As a developer, I want the browsing state and its storage in one hook with a small return value, so that a change to browsing touches one place.
23. As a developer, I want the Team link hook to return a join part and a joined-game part, so that each consumer takes only the part it uses.
24. As a developer, I want the joined-game part to be absent until a view has arrived, so that the page stops defaulting answers, grades and ratings it can't have yet.
25. As a developer, I want the join gate defined once in the Team link hook, so that /play and the home page can't drift apart.
26. As a developer writing a /play test, I want the Team link fake to mirror the two-part shape and build the joined game from a described session, so that a test overrides only what it is about.
27. As a developer, I want the player menu bridge to take only the join part, so that the header doesn't depend on game data.

## Implementation Decisions

- **New hook: phone question browser**, in the /play area.
  - **Input:** the players view, or nothing while there is no view. It is called before /play's early returns, so it accepts an absent view and returns an empty selection.
  - **Output:**
    - the selected question, or none when the phone screen isn't `block` or no question resolves
    - the reveal question: the selected question from the view's revealed questions, during `reveal` only
    - the navigation: can go back, can go forward, back, forward; present only with auto-advance off
    - the jumpable question ids: the block's questions while the block browser is shown, otherwise none
    - `selectQuestion(id)`
    - the auto-advance setting and `setAutoAdvance(enabled)`
  - **Inside:** the browsed pick, the auto-advance setting (on by default, corrected from localStorage after mount, written through the existing player settings storage on change), the previous current-question id and reveal step used to spot a change, and the render-time sync. It delegates the choice to the existing pure phone question selection and to the auto-advance-change rule, both unchanged.
  - **The page keeps** the layout, the answered-history list and the selected question's awarded points, which come from the team's history, not from browsing.
- **Team link hook result becomes two parts.** One hook, one socket and one Team link state machine, as today. It must not become two hooks, which would open two connections. Only the return shape changes:
  - **Join part:**
    - team name, team (the join payload, or none), has stored identity, active join code, connection error
    - the name, game code and team code inputs with their setters
    - join, log out
    - **needs join form**: the shared gate, true when there is no team name, or no join code and no view, or a connection error with no team. It is computed once here; /play and the home page's join panel both read it, and the copied gate and its "mirrors /play" comment are removed.
  - **Joined game part**, present once a view has arrived and absent otherwise:
    - the players view, which is never absent inside this part
    - my answers, my answer grades, my bonus awards, my round ratings, my feedback, the round ratings epoch, seen questions
    - submit answer, submit showdown guess, rate round, send feedback
- **Consumers:**
  - **/play:** uses the join part for the join form, the "Connecting…" screen and the header identity; uses the joined game for everything after; and passes the joined game's view to the phone question browser. The page's own defaults for missing answers, grades, ratings and feedback go away.
  - **The home page's join panel:** uses the join part, plus whether a joined game exists, to tell connecting apart from joined. Its own "connecting vs joined" split (by whether the team is present) is unchanged.
  - **The player menu bridge:** takes the team name, the team and log out from the join part.
- **Behaviour of the hook itself is unchanged:** commands, the pending answer, the confirmation timer, storage, toasts and the reconnect paths. The Team link state machine module is not touched.
- **No change** to shared types, the socket protocol, the backend, or what any screen shows.
- **Docs:** GLOSSARY's **Team link** entry already separates joining from the team's own data, so it only gains a sentence if the two parts need names. Add a short **Auto-advance** entry if none exists ("the phone follows the big screen's current question and reveal step; off, the team browses the block freely"). DOCUMENTATION.md and the /guide page are unaffected, since behaviour doesn't change.

## Testing Decisions

- **What makes a good test here:** it renders the real page (or the real join panel) from a described session and asserts on what a team sees and can tap. That means the question shown, the navigation buttons, the reveal answer, the join form and the history jumps. It never asserts on hook internals, state variables or how many renders happened. A behaviour-preserving refactor proves itself when the existing tests pass with unchanged assertions.
- **Seams: the two that exist, and no new seam.**
  - **/play and the home page tests**, through the faked Team link hook with real room views (`roomView` from a described session), stay the seam for the page and the phone question browser. Browsing is exercised there exactly as today, through the question navigator, the auto-advance setting, break and reveal, and the answered questions tests. The phone question browser is not faked in those tests, so the page tests cover it for real.
  - **The Team link hook's own tests**, with a mocked socket.io client, stay the seam for the hook. They update only how they read the result (join part, joined game part).
  - **The pure phone question selection** keeps its existing table tests.
- **The Team link fake changes shape, not meaning.**
  - Its `join` part keeps today's lazy reads from localStorage (a saved team name means joined), so the `joinAsTeam` helpers keep working.
  - Its joined game is built from the described session, or absent when there is none.
  - A test overrides `join` or `game` fields only.
  - All 15 /play test files and the home page test switch to it mechanically.
- **New cases**, written test-first through the existing seams:
  - Team link hook: the join form is needed with no team name, with a restored name but no join code and no view, and with a connection error and no team; it is not needed once a view has arrived
  - Team link hook: the joined game is absent before the first view and present after it, and it carries the team's data from the join payload
  - /play: the join form and the home page's join panel agree for each gate case, driven from the same fake
  - /play: with auto-advance off, the navigation survives a re-render that brings a new view for the same question
- **Prior art:** the play tests (question navigator, auto-advance setting, break and reveal, join and reconnect), the home page test, and the `use-team-link` and `use-team-link-team-data` hook tests.
- Run with `pnpm --filter frontend test <path>` per touched test, then the full frontend suite, `pnpm typecheck` and `pnpm lint`.

## Out of Scope

- Changing any phone behaviour: auto-advance, snap back, navigation, the reveal or the join gate's conditions.
- Changing the Team link state machine, the answer confirmation timer, storage keys or reconnect handling.
- Splitting the /play layout into more components beyond what moving browsing out needs.
- The reveal view carrying its reveal kind (review candidate 07, the [reveal-kind](../reveal-kind/spec.md) spec), even though the block browser's reveal branch would benefit from it.
- The /control and /display hooks.
- Persisting the browsed question across reloads.

## Further Notes

- **Order that keeps the suite green:**
  1. Extract the phone question browser hook (page-only change, page tests unchanged).
  2. Reshape the Team link result into its two parts with the shared gate, moving the fake, the page, the join panel and the player menu over together. The fake is shared by every consumer test, so this step lands as one change.
- This is a pure refactor. A test whose assertions need changing means behaviour drifted, so investigate it rather than updating it.
- Commit scope is `frontend` for code and `repo` for GLOSSARY.
