# 05: Answers change module

**What to build:** A team submitting an answer, and the quiz master grading an answer by hand, behave exactly as today. The answers change module now builds both, following the pattern from ticket 01.

**Submit.** It keeps its checks in order, both before the answer is stored:

1. The question is still open for answering.
2. The socket owns the team's seat.

The kahoot response time is still measured from the phase start inside the write. The "answer received" reply to the sender still carries the graded points for auto-graded types.

**Grade.** The answer service's grading errors (an unknown answer, a closest-guess answer) become refusals carrying its message, or "Unable to grade answer" when it gives none.

**Shared answer refresh.** Both events use it, and it is private to the module. It updates the question's answered-team ids, runs the Grading refresh for that question, and names the question for a fresh admin answer list.

Both façade methods are one `write` call that reads standings, as today. The module takes the answer service and block grading.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Submit answer and grade answer are built by the answers change module. Their façade methods are each a single `write` call.
- [ ] The answer refresh is private to the module and is the only path either event takes to the Grading refresh.
- [ ] Refusal messages are unchanged.
- [ ] The module imports neither the Session write module nor the game state class.
- [ ] Every existing backend spec passes without edits, in particular:
  - submit-answer, answer-recorded-and-graded, grading, grading-gate, kahoot-answer-speed, last-second-answer, roster-answer-grading-isolation, ungraded-agreement, the answer controller spec,
  - the session-write spec's answer and grade cases.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
