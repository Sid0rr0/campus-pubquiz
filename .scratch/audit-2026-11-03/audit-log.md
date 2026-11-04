# Repo audit log — 2026-11-03

Whole-repo audit (`/ponytail-audit`) at commit `0c213b4e`. Read-only: no code changed. No test suites or mutation runs. One web search on Azure's `X-Forwarded-For` format; nothing was run against the deployed backend.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; backend reachable from the open internet (phones on mobile data). A few hundred to a few thousand teams stored over time.

Started from the 2026-11-01 logs' "Not checked" lists, plus the 13 commits since `b7caacfb` (notes at reveal, clip replay, fullscreen answer media, join ticket on /play, team code on the team page, team search).

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Team search | `team/team.service.ts` (`listAll`, `join`), `teams-query.schema.ts`, `teams.controller.ts`, `teams/teams-directory-panel.tsx`, `lib/teams-api.ts` | LIKE escaping, count matches page, page reset, staff-only | OK |
| Team code on team page | `teams/[id]/team-detail-panel.tsx`, `GET /teams/:id/code` | staff guard | OK |
| Team codes | `db/join-code.util.ts`, `db/entities/team.entity.ts`, `team-history.service.ts` (`teamByCode`) | space (1202 × 52 × 355 ≈ 22M), uniqueness | **No unique index** (finding 4) |
| Team page | `team/team-page.controller.ts`, `team-page.schema.ts`, `team-history.service.ts` | throttle, what it reveals, took-part check | OK; limit depends on finding 1 |
| Throttler / proxy | `main.ts`, `app.module.ts`, `auth/auth.controller.ts` | what key the throttler counts | **Port in `req.ip` on Azure** (finding 1), not confirmed live |
| League table | `league/league-table.service.ts`, `league-table.calc.ts`, `venue-date.ts`, `game/state/league-changes.ts` | points, ties, current leagues, lobby top | OK; order comment wrong (finding 5) |
| Live-edit frontier | `shared/types/src/live-edit-frontier.ts`, `quiz/live-edit-guard.ts`, `game/live-edit/live-edit.service.ts` | frontier merge, pinned prefix, lock reasons, regrade ids, answered-question guards | OK |
| CSV codecs | `shared/types/src/question-csv-codec.ts`, `question-kind.ts`, `question-preview-schema.ts`, `answer-kind.ts` (formats) | separators, round trip | **`|` and `+` inside items** (finding 2) |
| Notes group | `shared/types/src/notes-group.ts`, `round-note.ts` | settings group parse/write, host-only text, reveal notes | OK |
| Notes at reveal | commit `a77a8771` (backend, shared) | migration, seed, phones never get them | OK |
| Clip replay | commit `29fe64c1` (`shared/types/src/media.ts`) | same-video rule, half-typed clips | OK |
| Join ticket | `components/join-form.tsx` | code field reveal | OK |
| Ended sessions read | `ended-sessions-read.ts` (queries, `participations`, `endedSession`) | took-part rule, ended filter | OK |
| Seed | `db/seed.service.ts` (`seedOpenGames`, `seed`, `createSession`, `loadGame`) | callers of `seed()` | **Dead reuse branch** (finding 3) |

## Findings

1. On Azure the throttler may count each connection, not each client — should fix (confirm one header first)
2. A `|` or `+` inside an option breaks the CSV export round trip — nice to have
3. `seed()`'s reuse branch is dead in production — nice to have (lean)
4. Team codes have no unique index — nice to have
5. `positionsOf` says "newest league first" but uses the admin's order — nice to have

## Fixed (2026-11-03)

All five landed on `main` (`06204569` to `fd5ea5cf`). Checked in the later audit the same day (see `audit-log-2.md`): the fix commits were read, and the e2e suite passed (30/30) on `dacc2c5d`.

| # | Status | Commit |
| --- | --- | --- |
| 1 | Fixed: the throttler counts `clientIpOf(req)`, which drops an `ip:port` port (IPv4 and bracketed IPv6). Done without the live header check; dropping a port is safe whether Azure sends one or not | `06204569` |
| 2 | Fixed: an option or match item holding a list separator is refused at import and save; the separators are shared with the codec | `c4f41116`, `fd5ea5cf` |
| 3 | Fixed: `SeedService.seed` removed | `9a14f25a` |
| 4 | Fixed: `teams_code_unique` constraint (the migration renames older repeats to `code-id` first); new teams retry up to 5 codes | `2412f730`, `899b733c` |
| 5 | Fixed: comment and DOCUMENTATION say the admin's order | `94b8aa0c` |

## Not checked

- Frontend beyond the new commits (the 2026-11-01 frontend log covers the rest)
- e2e suite; CSS and accessibility; migrations older than the last four
- The real `req.ip` on Azure (finding 1 needs one logged header)
- `game-state.ts` transitions: unchanged since the last audit, not reread
- Test quality; no mutation runs
