# 08: A moderator runs the night

**What to build:** The admin creates a moderator on the users page; the moderator logs in through the UI (using the login budget) and runs a block from `/control`. Checks role auth over the socket, not just the admin cookie.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** done

- [x] The moderator can advance and grade.
- [x] Whatever the docs say a moderator can't do is refused in the UI.
- [x] Passes `--repeat-each=5`.
