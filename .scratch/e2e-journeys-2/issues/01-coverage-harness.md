# 01: Coverage registry, snapshots and media interception

**What to build:** The machinery every later ticket uses, proven on the existing happy path.

1. `e2e/support/coverage.ts`: every status × screen cell (big screen, phone, `/control`) and every move and overlay listed in the spec.
2. A snapshot helper (`snap(screen, status)`) that runs `toMatchAriaSnapshot` against a snapshot file and records the cell; move helpers record their move.
3. A custom reporter that fails a full run listing every unvisited cell and move, and skips the check on filtered runs (file, `--project`, `--grep`, `--repeat-each`).
4. Media interception: `page.route` serves committed fixture mp3/mp4/png for `example.invalid` and a blank stub for `youtube.com/embed/*`, applied to every context by the fixtures.
5. The happy path snapshots each status it passes through on all three screens, keeping its hand assertions.
6. Semantic markup added to the frontend wherever a happy-path screen snapshots as flat text.

Until later tickets land, the reporter's full-run check is expected to fail; give it an `E2E_COVERAGE=off` escape hatch and switch the default to on in ticket 15.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** none

**Status:** done

- [x] Registry, snapshot helper and reporter exist; the reporter lists missing cells.
- [x] The happy path snapshots every status it visits on all three screens.
- [x] The audio question's player loads the intercepted fixture.
- [x] Existing journeys pass `--repeat-each=5`; frontend Vitest still passes.
