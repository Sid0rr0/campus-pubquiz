# 04: Every screen resyncs after a backend restart

**What to build:** A journey that kills and restarts the backend mid-block, then checks that `/control`, `/display` and the phones resync with nothing lost. It runs in its own Playwright project with one worker, which depends on the main project.

1. Two teams join. The quiz master opens questions in the block, and both teams answer.
2. The backend helper stops the backend.
3. The screens show they're disconnected or reconnecting, as they do today. Assert whatever indicator each screen already has; don't add one.
4. The backend helper starts the backend again on the same port and database.
5. All three screens come back to the same status and question without a reload. The phones show their teams and their earlier answers. `/control` shows both teams connected.
6. The game carries on: a team changes an answer, the block locks, grading and standings work.

A second case: restart during `locking`. The lock deadline is re-armed after the restart and the block still locks.

Parent spec: `.scratch/e2e-tests/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The backend helper's stop and start leave no orphaned process, including when a test fails.
- [ ] The mid-block restart case passes.
- [ ] The restart-during-locking case passes.
- [ ] Both pass `--repeat-each=5`.
