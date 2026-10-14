# 02: The frontend suite runs on happy-dom

**What to build:** The frontend's Vitest environment switches from jsdom to happy-dom, and a full local run drops from about 16s to about 10s with no spec changed. jsdom leaves the frontend's dev dependencies and happy-dom joins them; there is one test DOM, for every file, with no per-file environment overrides.

The config pins happy-dom's resource loading off — iframe pages, JavaScript files and CSS files — so the suite stays offline even if a happy-dom upgrade changes a default (the `/display` media spec renders a YouTube embed). The local worker limit (50% of cores) and CI's default stay as they are.

Parent spec: `.scratch/frontend-happy-dom/spec.md`

**Blocked by:** 01 (Unmocked network requests fail the frontend suite)

**Status:** ready-for-agent

- [ ] The frontend suite runs on happy-dom; jsdom is no longer a frontend dependency
- [ ] The test names in a happy-dom run (JSON reporter) match the last jsdom run exactly — no spec skipped or dropped
- [ ] Three full runs before and three after, with the medians recorded in this ticket's Comments
- [ ] Five consecutive full runs green
- [ ] The run output has no `ECONNREFUSED` or happy-dom `Fetch.onError` lines
- [ ] Iframe, JavaScript and CSS file loading are explicitly off in the config
- [ ] Typecheck, lint and the frontend build pass
