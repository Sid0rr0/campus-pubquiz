# Security Policy

## Reporting a Vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/Sid0rr0/campus-pubquiz/security/advisories/new) rather than opening a public issue. Include steps to reproduce and the potential impact.

## Known Security Posture

This is a small, single-event live-quiz app, not a multi-tenant SaaS product. Some tradeoffs are accepted deliberately — see `CLAUDE.md` → "Known Tradeoffs (Accepted)" for the full list:

- **Admin auth** is a single shared password (env var `ADMIN_PASSWORD`) behind a signed cookie / socket handshake check. No per-user accounts, no audit trail.
- **Team auth** is a per-session join code; team identity is a token in `localStorage`. There is no server-side rate limiting on join attempts yet.
- **Secrets** (`DATABASE_URL`, `ADMIN_PASSWORD`, `FRONTEND_ORIGIN`) are supplied via environment variables at deploy time (see `render.yaml`) and loaded locally via `.env` (gitignored, never committed).
- **Question import** reads a user-uploaded CSV client-side and posts its text to `/import/preview` / `/import/confirm`, both guarded by the admin password. There is no server-side fetch of a user-supplied URL, so there is no SSRF surface in the import path.
- **Answer key exposure**: `SeedService` strips the stored answer from every player-facing `QuestionView`, so answers are never sent to team clients before reveal.

## Supported Versions

This project does not follow a formal release/support cycle — security fixes land on `main` and should be deployed promptly after merge.
