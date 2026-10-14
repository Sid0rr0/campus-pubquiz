# 05: Document how to run E2E

**What to build:** The docs that own what this spec changed.

- `CLAUDE.md`:
  - `pnpm e2e` under Development Commands, with a note that it needs the docker-compose Postgres and isn't part of `pnpm test`, the pre-commit hook or CI;
  - `e2e` in the commit-scope list.
- `README.md`: a "Running E2E" section covering what it needs (Postgres running), the ports and database it uses, how to run one file or one project, and where the report goes.
- `DOCUMENTATION.md`:
  - in "Deploy and CI", one line saying E2E runs locally only;
  - in "Teams: Join, Reconnect, and Kick", fix the Kick line: the Teams panel offers Kick for every team, a connected team's socket is closed, and its phone forgets its stored identity, so it rejoins with the recovery code.

No `GLOSSARY.md` entry and no ADR.

Parent spec: `.scratch/e2e-tests/spec.md`

**Blocked by:** 01

**Status:** done

- [x] All three files are updated.
- [x] The README steps work as written from a clean checkout. (Checked by reading `playwright.config.ts`, `support/env.ts`, `support/servers.ts`, `global-setup.ts` and the package scripts, not by running E2E.)
