# 01: Agreement walk pins today's preview against the real press

**What to build:** A characterization spec that walks whole quizzes through the real-store gateway harness and, before every press, takes the /remote presenter preview's "next" screen, presses, and checks that the screen now on air matches it: the heading, plus the on-air screen kind and key, not only the heading. A press that moves nothing must have been previewed as moving nothing (or as "waiting"). It runs against today's code. Today's disagreements are pinned as named exceptions so later tickets can remove them one at a time. It is the safety net for the rest of this feature. Extend the presenter context spec's existing "agreement with /display" walk and reuse the advance-plan walk's press-and-compare helpers rather than starting a new harness.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Walks cover: a two-block quiz through break, reveal and the end-of-block leaderboard; a break with an ungraded match-or-human answer, refused, then graded by the moderator and advanced; a break where a live answer-key fix makes an answer ungraded, then it is graded; a closest_guess reveal with its sub-steps, including showing and hiding the leaderboard mid-reveal and moving into a closest_guess reveal from an earlier question; a kahoot round's between-questions board and round-end board with the top-5 cutoff; a leaderboard tie; an ended quiz with an active showdown, including "waiting for every guess" and the final resolving step; the lobby start
- [x] At every point, the previewed "next" screen matches the screen on air after the press (heading, on-air screen kind and key), or the press moves nothing and the preview said so
- [x] Today's disagreements are listed as named exceptions in the walk, each with a one-line reason (at least: the ungraded break preview names the reveal while the press is refused; anything closest_guess or key-fix related that disagrees)
- [x] The spec passes against the current code with no production changes

## Comments

Implemented in `apps/backend/src/game/__tests__/presenter-context.spec.ts` (new describe "the preview agrees with the real press across whole quizzes"), with no production changes. The press-and-compare machinery (`createPreviewWalk`) and the answerer lifted out of `action-availability.spec.ts` live in `walk-test-utils.ts`, which both specs now use.

- The preview carries only a heading, so "kind and key" are checked through the on-air screen: the previewed heading must match the heading pattern of the screen kind /display shows after the press, and the screen key must change whenever the heading does.
- A press that moves nothing must have been previewed as moving nothing, or as "Waiting for every guess".
- Named exceptions are listed in `KNOWN_DISAGREEMENTS`; each walk asserts the exact set it meets, so a ticket that removes one must update the spec.

Only one disagreement exists today: **ungraded break previews the reveal** (the preview names the reveal's round title card while Advance is refused until every answer is graded). It shows both when a typed answer waits for the moderator and when a live key fix leaves a matched answer ungraded. The closest_guess walk (sub-steps, leaderboard shown and hidden mid-reveal, entering it from an earlier question), the key-fix walk after the answer is graded, the kahoot walk, the tie, the showdown and the lobby start all agree today, so they pin no exceptions.
