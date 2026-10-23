# Mutation testing: follow-up after the first audit

Status: ready-for-agent

The first audit (`.scratch/mutation-testing`, PR #76) took `shared/types` from 63.9% to 98.5% and the backend's DB-free slice from 56.1% to 97.8%. A full rerun on 2026-10-24 left two loose ends:

- A flaky backend spec can fail Stryker's initial test run, which aborts `pnpm mutate` before it tests anything (ticket 01).
- Small survivor clusters remain in both workspaces, including three in `auth/session-cookie.ts` that ticket 12 of the first audit was meant to clear (tickets 02 and 03).

Work each survivor ticket as in `.scratch/mutation-testing/spec.md` "How to work an issue": a one-file `stryker run --incremental --mutate <file>` per file. Keep runs light on memory: Stryker is capped at 8 workers in config. Don't raise it, and don't run several test or Stryker commands at once on this machine (24 GB RAM, swap fills).
