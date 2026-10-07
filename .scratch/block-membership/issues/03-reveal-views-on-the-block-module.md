# 03: The reveal views are built on the Block module

**What to build:** Every view that shows the block's questions is built on the block in play, and nothing anywhere fakes a session to ask which questions are in a block. The big screen, phones, `/control` and `/remote` show exactly what they show today:

- block questions (answer-free) while answering and in the break;
- reveal questions from the reveal intro onward;
- the phone's ended reveal walk;
- the presenter preview's question.

The function that builds the block's reveal views takes the Block module's positions and dresses each with its question, its closest_guess summary (for batch-graded types), its round number, its question number in its round and its round title. Block questions and reveal questions keep their status windows on top. The ended reveal walk passes the status the quiz ended from to the Block module as a progress, not as a session copy. Past revealed questions stay as they are.

The equivalence test from 01 becomes a check that the reveal views list the same questions, in the same order, as the Block module.

Docs, in the same change:

- `CODING_STANDARDS.md`'s game-state section gains: "Ask the Block module which questions are in the block in play for a progress; never build a session copy with a swapped progress to ask a view function."
- `docs/architecture.md` shows the Block module, if its live-session diagram lists the block questions helper.

Parent spec: `.scratch/block-membership/spec.md`

**Blocked by:** 01 (The Block module, with grading asking it), 02 (The Settle step and the answering gate ask the Block module)

**Status:** ready-for-agent

- [ ] No backend code outside tests builds a session copy with a swapped progress to read the block (search for spreads of the session with a replaced progress).
- [ ] The reveal views are built from the Block module's positions; the equivalence test checks the views follow the module.
- [ ] The block questions, past revealed questions, players reveal redaction, screen projection, screen projection delivery, presenter context, reveal paging and on-air screen specs pass without edits.
- [ ] `CODING_STANDARDS.md` and (if applicable) `docs/architecture.md` are updated.
- [ ] `pnpm --filter backend test`, `pnpm lint` and `pnpm typecheck` pass.
