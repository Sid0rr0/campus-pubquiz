# 01: Agreement walk pins today's preview against the real press

**What to build:** A characterization spec that walks whole quizzes through the real-store gateway harness and, before every press, takes the /remote presenter preview's "next" screen, presses, and checks that the screen now on air matches it: the heading, plus the on-air screen kind and key, not only the heading. A press that moves nothing must have been previewed as moving nothing (or as "waiting"). It runs against today's code. Today's disagreements are pinned as named exceptions so later tickets can remove them one at a time. It is the safety net for the rest of this feature. Extend the presenter context spec's existing "agreement with /display" walk and reuse the advance-plan walk's press-and-compare helpers rather than starting a new harness.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Walks cover: a two-block quiz through break, reveal and the end-of-block leaderboard; a break with an ungraded match-or-human answer, refused, then graded by the moderator and advanced; a break where a live answer-key fix makes an answer ungraded, then it is graded; a closest_guess reveal with its sub-steps, including showing and hiding the leaderboard mid-reveal and moving into a closest_guess reveal from an earlier question; a kahoot round's between-questions board and round-end board with the top-5 cutoff; a leaderboard tie; an ended quiz with an active showdown, including "waiting for every guess" and the final resolving step; the lobby start
- [ ] At every point, the previewed "next" screen matches the screen on air after the press (heading, on-air screen kind and key), or the press moves nothing and the preview said so
- [ ] Today's disagreements are listed as named exceptions in the walk, each with a one-line reason (at least: the ungraded break preview names the reveal while the press is refused; anything closest_guess or key-fix related that disagrees)
- [ ] The spec passes against the current code with no production changes
