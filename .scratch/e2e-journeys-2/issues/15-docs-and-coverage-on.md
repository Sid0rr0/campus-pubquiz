# 15: Docs and coverage check on

**What to build:** Turn the reporter's full-run check on by default, confirm a full run is green and under five minutes with `E2E_SKIP_BUILD=1`, and update the README's "Running E2E" section (coverage check, `--update-snapshots`, media fixtures, `E2E_COVERAGE=off`). Fold in any `DOCUMENTATION.md` fixes not already made by earlier tickets.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14

**Status:** ready-for-agent

- [ ] A full run has no unvisited cells or moves.
- [ ] A full run takes under five minutes with `E2E_SKIP_BUILD=1`.
- [ ] README updated.
