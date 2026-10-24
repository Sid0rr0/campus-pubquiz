# 02: Backend: remaining mutation survivors

Status: done

Blocked by: None

From the 2026-10-24 full run of `pnpm --filter backend mutate` (24 survived, 4 no coverage). All paths are under `apps/backend/src/`.

**Upload sniffing (`media/detect-image-type.ts`, 7). Do this first:** CODING_STANDARDS says uploads are untrusted and sniffed from magic bytes, and these mutants weaken the sniff without any test failing.

- `:15`: `signature.every(...)` → `some(...)` survives, so a file matching only one signature byte isn't tested.
- `:28`: the minimum header length guard survives `false` and `<` → `<=`. Test a buffer one byte short and one exactly at `MIN_HEADER_BYTES`.
- `:39`: the WebP check (`RIFF` and `WEBP`) can be forced to `true`.
- `:43`: the AVIF check survives `&&` → `||` and `true`, and `:9` survives an empty brand. Test `ftyp` with a non-AVIF brand, and each of `avif` and `avis`.

**Write queue (`game/state/session-write-queue.ts`, 4):**

- `:36`: dropping `.sort()` on the join codes survives. Test that a multi-session write takes its locks in sorted order whatever order the codes arrive in.
- `:19-20` and `:67`: the tail clean-up can be removed, so nothing checks that a finished queue releases its entry. Assert through the public API, not the private map.

**Question lock timers (`game/socket/question-lock-timer.registry.ts`, 6):** each `timers.delete`, `clear(key)` and `armedKeys.delete/clear` call (`:20, 24, 29, 55, 60, 69`) can be removed. Test that a cleared or fired timer can be re-armed, and that clearing a session forgets its armed keys.

**Session cookie (`auth/session-cookie.ts`, 3, left over from first-audit ticket 12):** `:20` (a cookie pair without `=` is skipped) survives `false` and `-1` → `+1`. Add a header like `foo; campus_pubquiz_session=abc`. `:4`: `SESSION_COOKIE_NAME` → `""` survives. Assert that extraction ignores a cookie with another name.

**Broadcast (`game/socket/game-broadcast.util.ts:41-51`, 4 no coverage):** the admin and display state-update senders aren't reached by any DB-free spec. Add a small spec with a fake server that records emits per room.

**Copy, disable with a reason:** the error message or name strings at `config/cors.config.ts:33`, `media/media-storage.ts:28` and `media/vercel-blob-media-storage.ts:15`.

**Assert, don't disable:** `session/session-settings.schema.ts:30` ("At least one bonus category must stay enabled"). The settings form (`apps/frontend/app/components/session-settings-form.tsx`) lets the moderator switch off every category, so this refusal is the only guard.

Done when a one-file run on each file named here shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
