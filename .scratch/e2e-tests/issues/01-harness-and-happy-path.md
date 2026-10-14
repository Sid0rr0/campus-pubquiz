# 01: E2E harness and the quiz night happy path

**What to build:** The `e2e/` Playwright workspace and everything a journey needs, proven by the first journey: a full block played across all three screens.

Harness, as set out in the spec's Implementation Decisions:

- `e2e/` workspace and the root `pnpm e2e` script, kept out of `pnpm -r test`;
- `next.config.ts` reads `distDir` from an env var, with the default unchanged;
- global setup: check Postgres is reachable, drop and recreate `campus_pubquiz_e2e`, migrate, build both apps for E2E, start the backend through the backend helper (spawn, wait until ready, stop and start) and the frontend on :8889, log the admin in once and save `storageState`;
- fixtures: import the CSV fixture over HTTP, create a session per test with `lockGraceSeconds` 1–2, and open the `/control`, `/display` and phone contexts;
- `retries: 0`, trace, screenshot and video for failed tests only; the report and results gitignored.

The happy path, in one test:

1. The quiz master opens the session's `/control`, and the big screen shows its lobby.
2. Two teams join from two phones, and both show up in the lobby and on `/control`'s Teams panel.
3. The quiz master moves through rules and the round intro. The big screen shows each question, and the phones show it too.
4. Team A answers the `free_text` question with the key, and Team B answers something else and then changes it (last write wins). Both answer the `multiple_choice` question. The `audio` question renders on the big screen.
5. The block locks after the short countdown, and the phones can no longer change their answers.
6. In the break, the moderator grades Team B's typed answer on `/control`.
7. The reveal shows the answers. The standings on the big screen and the phones match the expected points.

One extra test logs in through the `/login` page and imports the CSV through the UI.

Parent spec: `.scratch/e2e-tests/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `pnpm e2e` runs from a clean checkout with only the docker-compose Postgres running, and leaves :8888, :3000, `.next` and `campus_pubquiz` alone.
- [x] If Postgres isn't running, the run stops in setup with a clear message.
- [x] The happy path passes and makes its assertions on what the screens show.
- [x] The UI login-and-import test passes.
- [x] Both pass `--repeat-each=5`.
- [x] `pnpm lint` and `pnpm typecheck` pass, and `pnpm test` doesn't run E2E.
