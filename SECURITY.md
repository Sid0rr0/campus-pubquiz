# Security Policy

## Reporting a Vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/Sid0rr0/campus-pubquiz/security/advisories/new) rather than opening a public issue. Include steps to reproduce and the potential impact.

## Known Security Posture

This is a small, single-event live-quiz app, not a multi-tenant SaaS product. Some tradeoffs are accepted deliberately — see `CLAUDE.md` → "Known Tradeoffs (Accepted)" for the full list:

- **Admin/moderator auth** is per-user accounts (`admin`/`moderator` roles) with bcrypt-hashed passwords. Login issues an opaque, DB-backed session token with sliding expiration, delivered as an httpOnly, `Secure` (in production), `SameSite` session cookie rather than a token exposed to JS — REST calls send it via `credentials: 'include'`, and the Socket.IO handshake reads it from the raw `Cookie` header. Self-registration creates a `pending` account; an existing admin must approve it and assign a role before it can log in. Deactivating a user immediately revokes all of their sessions. The first admin account is bootstrapped from the `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` env vars (see `render.yaml`) since self-registration alone can't produce an approver.
- **Team auth** is a per-session join code; team identity is a token in `localStorage`. There is no server-side rate limiting on join attempts yet.
- **Secrets** (`DATABASE_URL`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `FRONTEND_ORIGIN`) are supplied via environment variables at deploy time (see `render.yaml`) and loaded locally via `.env` (gitignored, never committed).
- **Question import** reads a user-uploaded CSV client-side and posts its text to `/import/preview` / `/import/confirm`, both guarded by session auth (any authenticated admin or moderator). There is no server-side fetch of a user-supplied URL, so there is no SSRF surface in the import path.
- **Answer key exposure**: `SeedService` strips the stored answer from every player-facing `QuestionView`, so answers are never sent to team clients before reveal.

## Supported Versions

This project does not follow a formal release/support cycle — security fixes land on `main` and should be deployed promptly after merge.
