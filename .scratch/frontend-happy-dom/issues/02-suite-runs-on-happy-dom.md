# 02: The frontend suite runs on happy-dom

**What to build:** The frontend's Vitest environment switches from jsdom to happy-dom, and a full local run drops from about 16s to about 10s with no spec changed. jsdom leaves the frontend's dev dependencies and happy-dom joins them; there is one test DOM, for every file, with no per-file environment overrides.

The config pins happy-dom's resource loading off — iframe pages, JavaScript files and CSS files — so the suite stays offline even if a happy-dom upgrade changes a default (the `/display` media spec renders a YouTube embed). The local worker limit (50% of cores) and CI's default stay as they are.

Parent spec: `.scratch/frontend-happy-dom/spec.md`

**Blocked by:** 01 (Unmocked network requests fail the frontend suite)

**Status:** done

- [x] The frontend suite runs on happy-dom; jsdom is no longer a frontend dependency
- [x] The test names in a happy-dom run (JSON reporter) match the last jsdom run exactly — no spec skipped or dropped
- [x] Three full runs before and three after, with the medians recorded in this ticket's Comments
- [x] Five consecutive full runs green
- [x] The run output has no `ECONNREFUSED` or happy-dom `Fetch.onError` lines
- [x] Iframe, JavaScript and CSS file loading are explicitly off in the config
- [x] Typecheck, lint and the frontend build pass

## Comments

**Change.** `apps/frontend/vitest.config.ts` sets `environment: 'happy-dom'` with `environmentOptions.happyDOM.settings` pinning `disableIframePageLoading`, `disableJavaScriptFileLoading` and `disableCSSFileLoading` to `true`. `jsdom` is removed from the frontend devDependencies, `happy-dom` (21.0.1) added; `pnpm-lock.yaml` updated. No other package imported jsdom. No spec changed; the 50% local worker limit and CI default are untouched.

**Timing** (full local run, default 50% workers, Vitest's reported Duration):

- jsdom, before: 13.62s, 15.10s, 14.15s, median **14.15s** (environment set-up summed about 34-38s)
- happy-dom, after: 9.52s, 9.58s, 9.41s, median **9.52s** (environment set-up summed about 14s)

**Test names.** JSON-reporter lists (file, full name, status) from the three jsdom and three happy-dom runs are identical: 1,152 tests (1,150 plus ticket 01's 2 guard tests). No spec skipped or dropped.

**Stability.** Five further consecutive full runs on happy-dom: all green, 117 files / 1,152 tests, 9.1-9.6s. No `ECONNREFUSED` or `Fetch.onError` lines in the output (ticket 01's guard also fails any spec that reaches the network).

**Expected stderr noise.** With iframe loading explicitly disabled, happy-dom logs `Failed to load iframe page "https://www.youtube-nocookie.com/embed/...". Iframe page loading is disabled.` for the YouTube embed specs in `/display` media-rendering. That is the pin working (the iframe is refused, not fetched), not a network request. Left as is; silencing it would mean spying on `console.error` in that spec.

**Verification.** `pnpm typecheck`, `pnpm lint` and `pnpm --filter frontend build` pass.
