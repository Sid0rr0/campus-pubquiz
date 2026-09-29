# Spec: A Screen projection per room

Status: ready-for-agent

## Problem Statement

The backend sends the same state snapshot to every room: display, admin and players. Each page then works out for itself what is on screen, which question that is, whether teams may answer, and whether Advance is legal. The same rules end up written several times, in slightly different ways, and secrecy depends on the phone choosing not to show something it has already received.

- **A hidden kahoot question reaches the phones early.** In a kahoot round, the next question opens behind the between-questions leaderboard and stays hidden until the quiz master dismisses the board. The snapshot already contains that question's prompt and options, both as the current question and inside the block questions. The only thing keeping it off a team's screen is a filter in the phone's socket hook ("must not leak its prompt early") plus the play page's answerability check. Anyone who opens the browser's network tab can read the next question before it is shown, and any new phone view that forgets the filter shows it.
- **"Hidden behind the kahoot leaderboard" is worked out in five places.** The backend answer gate, the play page's answerability, the socket hook's seen-questions filter, the display page's "between kahoot questions" animation and the control page's leaderboard step count each recompute "kahoot round and leaderboard visible". A change to when a kahoot question counts as hidden has to find all five.
- **"Which question is on screen" is explained three times.** During break and reveal the game's round index stays pinned to the block's last round, and the question on screen is chosen by the reveal index. The display page, the control page and the play page each re-derive this, each with its own long comment explaining the trap. Round title cards (round intro, reveal intro, break round intro) each look up their round a different way.
- **The presenter preview copies the display page by hand.** The /remote "now showing / next" preview is built by a backend module whose own doc comment says it "mirrors display/page.tsx's per-status branches". When the display gains or changes a screen, the preview drifts unless someone remembers to update both.
- **Advance legality lives on the client.** Whether Advance and Previous are allowed is computed in the browser from the status, the showdown state, the reveal index and a block start position. /control rebuilds that block start position from a separately fetched quiz list, and the backend enforces its own version of the same rules when the action arrives. A button can be enabled for an action the server will reject, or disabled for one it would accept.
- **Answerability exists twice.** The backend's "is this question open for answering" check and the play page's "is answerable" check are two copies of one rule, and a comment on each says it mirrors the other.

The root cause is that no module owns the answer to "what is each audience looking at right now, and what may it do". The snapshot is a raw dump of session state, and every consumer projects it on its own.

## Solution

A Screen projection module on the backend turns the live session into one view per room:

- **Display view:** what the big screen shows. That is the named current screen, the question or round title card on it, and the header content.
- **Admin view:** everything the display view has, plus which question is on display (for the grading panel's default), which round's title or break indicator is lit, and whether Advance and Previous are legal right now.
- **Players view:** what a team's phone may see and do. The question on screen, which questions are answerable, and nothing that has not been shown yet. A kahoot question hidden behind the leaderboard is removed before the payload leaves the server.

The projection names the current screen (lobby, rules, round overview, round title, question, locking, break intro, break review, break round title, reveal intro, reveal, leaderboard, ended, showdown), and with it the question or round that screen is about. "Hidden behind the kahoot leaderboard", "which question is on screen during break/reveal", "can a team answer" and "can the admin advance" are each decided once, inside the projection.

Each room receives its own view on every state broadcast, and on connect or reconnect. Pages only render what they are given. They keep only purely local UI state such as a team's browsed question, the admin's manual grading pick, and animation bookkeeping. The /remote presenter preview is built from the same projection (the current session, and the session after the next Advance), so it cannot drift from the display.

## User Stories

1. As a team, I want the next kahoot question's prompt and options never to reach my phone while it is hidden behind the leaderboard, so that no team can read it early from the network traffic.
2. As a quiz master, I want the secrecy of a hidden kahoot question enforced by the server, so that a new phone screen or a buggy client can never show it early.
3. As a team, I want the hidden kahoot question to appear on my phone the moment the quiz master dismisses the leaderboard, so that I can answer it at the same time as it appears on the big screen.
4. As a team, I want my phone's answer history to never list a question before it has been shown, so that I can trust it reflects what the room has actually seen.
5. As a team whose phone reconnects while a kahoot question is hidden, I want the resync to leave it hidden too, so that reconnecting is never a way to peek.
6. As a team, I want my phone to follow the big screen through reveal one question at a time, so that I see my answer next to the question being revealed.
7. As a team, I want my phone to show the same round title card as the big screen during reveal intro and break round intro, so that I know which round we are in.
8. As a team, I want answering to stay available while the leaderboard is up over a question I've already seen, as it does today, so that the board doesn't cut me off mid-answer.
9. As a team, I want answering to stay available when the quiz master steps back into a round intro whose questions are already open, as it does today, so that Previous doesn't lock me out.
10. As a team, I want my phone and the server to agree on whether a question is answerable, so that I never see an answer box that rejects my submission.
11. As a quiz master, I want the Advance and Previous buttons enabled exactly when the server will accept them, so that I never press a button that errors, or am blocked from a legal step.
12. As a quiz master using /remote, I want the same Advance and Previous availability as /control, so that presenting from my phone behaves like the laptop.
13. As a quiz master, I want Previous to stay available through break and reveal exactly as it is today, including stopping at the true start of the reveal history, so that the gating move doesn't change behaviour.
14. As a quiz master, I want the showdown's Advance and Previous availability after the quiz ends to stay as it is today, so that tiebreakers still walk step by step.
15. As a quiz master, I want the grading panel to default to the question currently on the big screen during question open, break and reveal, so that I grade what the room is looking at.
16. As a quiz master, I want the round row's title indicator lit whenever a round's title card is on the big screen, including reveal intro and break round intro, so that the question browser mirrors the display.
17. As a quiz master, I want the round row's break indicator lit throughout a break, including its intro and round title pauses, as it is today.
18. As a quiz master using /remote, I want the "now showing" line to always describe exactly what /display renders, so that I can present without looking over my shoulder.
19. As a quiz master using /remote, I want the "next" line to describe exactly what the next Advance will put on /display, including leaderboard reveal steps, closest_guess reveal sub-steps and showdown steps, so that there are no surprises on stage.
20. As a quiz master, I want host notes and the next-screen preview to keep going only to the admin room, as they do today, so that the audience never sees them.
21. As a quiz master, I want the correct answers of the current block to keep reaching phones only once reveal starts, as they do today, so that the projection change never leaks an answer.
22. As an audience member watching the big screen, I want screen transitions to animate only when what's on screen actually changes, as they do today, so that a ticking answer count doesn't replay the transition.
23. As an audience member, I want the header's round, title and question badge to match the question on screen during break review and reveal, so that the big screen never labels a question with the wrong round.
24. As an audience member, I want the between-kahoot-questions leaderboard to keep animating from the old standings to the new ones, so that kahoot rounds keep their race feel.
25. As a big-screen display that reconnects mid-quiz, I want the resync to put me on the same screen I would have shown without the drop, so that a network blip is invisible.
26. As a quiz master whose laptop reconnects mid-quiz, I want the resync to restore the same Advance and Previous availability and on-display question, so that I can carry on at once.
27. As a developer, I want "which screen is on air" named in one place, so that adding a screen means adding one case to the projection, not editing three pages and the presenter preview.
28. As a developer, I want "hidden behind the kahoot leaderboard" defined once, so that changing when a kahoot question counts as hidden touches one rule.
29. As a developer, I want each room's payload to have its own type, so that the compiler stops a players-only page from reading an admin-only field.
30. As a developer, I want to test what each audience sees at any point of a quiz without a browser, so that screen and secrecy rules have fast, direct tests.
31. As a developer, I want the phone's socket hook to trust the players view rather than filter it, so that secrecy has no client-side code path to get wrong.

## Implementation Decisions

- **New module: Screen projection** (backend, game state area). Pure and in-process. It takes the session record and an audience (display, admin, players) and returns that audience's view. It has no I/O and no socket knowledge, and it depends only on the session record and the shared game-state helpers already used by the snapshot builder.
- **The projection builds on the snapshot builder rather than replacing it outright.** The existing core snapshot fields stay as the shared base of every view, so the migration is incremental. Each audience view adds its computed fields and removes what that audience must not receive.
- **The projection names the on-air screen** as a discriminated value: a screen kind, plus the question or round the screen is about where there is one. It is the single place that handles the fact that the round index stays pinned during break and reveal. The same value supplies:
  - the display's transition key (today's screen key),
  - the display's header content,
  - the admin's on-display question id, title-card round index and break round index,
  - the players' on-screen question during reveal and round title cards.
- **One named rule for "question hidden behind the kahoot leaderboard"** (a kahoot round whose question is open while the leaderboard is visible). The projection uses it for players redaction, for answerability and for the display's between-kahoot-questions flag. The backend's answer-submission gate calls the same rule instead of keeping its own copy.
- **Answerability is computed server-side.** The players view states whether the current block is answerable. The rule is the one the play page uses today: question open or locking, or a round intro with questions already open, and never while a kahoot question is hidden. The submit-answer gate and the players view read one function, so they cannot disagree.
- **Advance legality moves server-side.** The admin view carries whether Advance and Previous are legal right now, derived from the same state machine and intercepts (showdown, closest_guess sub-steps, leaderboard reveal steps) that the action handler applies. The block start position is computed from the session's own rounds, so /control no longer rebuilds it from a separately fetched quiz list. /control and /remote read these flags. The client-side advance-gating helper is deleted.
- **Players redaction, scoped deliberately.** While a kahoot question is hidden behind the leaderboard, the players view omits it from both the current question and the block questions. Correct answers keep today's rules: in reveal and past-revealed questions only. This spec does not require trimming other fields out of the players view. A field may be dropped from an audience's view only when no page for that audience reads it.
- **The display view keeps the hidden kahoot question.** The display needs it so it can reveal the question the instant the leaderboard is dismissed, and the display never renders it while the board is up.
- **The presenter preview is rebuilt on the projection.** "Current screen" describes the display view's named screen. "Next screen" projects the session as it would be after the next Advance, using the same intercept order as today. The hand-maintained per-status mirror is deleted. The preview's wire shape (heading, body, optional question) stays the same, so /remote changes nothing but its data source. Presenter context stays on its admin-only channel.
- **Delivery is per room.** The state broadcast emits one state-updated event per room, each with that room's view, instead of one payload to all three rooms. The connect and reconnect resync sends the connecting role's view. Presenter context is still emitted first so the state update stays the latest emit. Reconnection resync is a core feature, and each role must get exactly the view a live broadcast would have given it.
- **Shared types gain one payload type per audience**: a shared base plus display, admin and players views. The phone's socket hook is typed per role, so a page receives the view for its own room. The existing single snapshot type stays only as the shared base.
- **The phone's socket hook stops filtering.** Its seen-questions merge takes every question in the players view as it arrives, and the kahoot-hidden special case is deleted.
- **Pages keep only local UI state:** the team's browsed question and auto-advance pin on /play, the admin's manual grading pick on /control, and the display's previous-leaderboard capture for animation. Everything else they currently derive comes from the view.
- **Recommended landing order.** First, the players redaction of the hidden kahoot question and the hook filter deletion, as a small separable fix the review calls worth doing now. Then the named screen with the display and presenter-preview migration. Then the admin view (on-display question, indicators, advance legality). Then the players view (answerability, on-screen question).
- **Relationship to the Live session module spec.** The projection reads the session record and does not depend on that work. If the Live session work lands first, its outcome delivery calls the projection once per room. If this lands first, the existing broadcast helper does.

## Testing Decisions

- **Good tests assert what an audience receives, not how it is computed.** Drive a session through a quiz with real actions and assert on each audience's view. Assert the screen kind and its question or round, answerability, advance legality, and presence or absence of content. Assert secrecy on the serialized payload, not only its types, since spreads can leak what types allow.
- **Primary seam: the Screen projection itself, in-process.** Walk sessions through a whole quiz: a normal block, a kahoot round, closest_guess reveal steps, a showdown, Previous back through break and reveal. At each step, assert every audience's view. This takes over the rules now covered piecemeal by the client-side advance-gating tests and the presenter-context tests. Prior art: the snapshot leak spec, which walks a quiz and asserts serialized snapshots, and the presenter context, block questions and closest-guess reveal specs in the backend game tests.
- **Secondary seam: per-room delivery through the gateway.** Using the existing gateway test harness, connect display, admin and players sockets and drive a kahoot round to a question hidden behind the leaderboard. Assert that the players socket's state-updated and state-sync payloads do not contain the hidden prompt, and that the display and admin payloads do. Also assert that a reconnecting socket gets its own role's view. Prior art: the kahoot leaderboard answer-gate spec, the session room scoping spec and the connection spec.
- **Frontend page tests keep their existing seam.** They render a page from a fixture payload through each area's test utilities, now built from per-audience view fixtures. Tests of derivations that move server-side (advance gating, on-display question, answerability) move to the projection tests rather than being duplicated. Page tests keep asserting what renders for a given view. Prior art: the display, play, control and remote page test suites and their shared fixture utilities.
- **The answer-submission gate** is covered by the existing kahoot leaderboard answer-gate tests, unchanged in intent. They prove that the gate and the players view's answerability agree, because both now read one rule.

## Out of Scope

- Deepening the Live session module (owning derived caches and outcome pushes). That is covered by its own spec.
- The Standings module (participation, ranking and ties), and moving leaderboard ranking server-side.
- Splitting the phone's socket hook into one hook per role, and moving socket emits to acknowledgements (review candidate 05). This spec only types the existing hook's payload per role.
- Collapsing the gateway's handler boilerplate (review candidate 06).
- Redacting any other field from any audience beyond the hidden kahoot question. Trimming fields no page reads is allowed but not required.
- Changing any screen's content, wording, layout or animation. Behaviour visible to the display, admin and teams stays the same apart from the secrecy fix.
- The standalone rules page and the stats pages.

## Further Notes

- Source: architecture review of 2026-09-30, candidate 03 ("Worth exploring"). Its evidence: the snapshot builder puts the block questions in the shared snapshot, and the phone's socket hook filters them with the comment "must not leak its prompt early". Beyond what the review says, the current question field carries the same hidden kahoot question to the players room, so the redaction must cover both fields.
- The admin view's advance legality has to match what the action handler accepts. If the two can diverge, the projection should derive legality by attempting the transition, the way the presenter's next-screen preview already probes the state machine, rather than restating the rules.
- No ADR conflicts. The one existing ADR (free text excluded from kahoot rounds) is unaffected.
