import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './env';

/**
 * `POST /auth/login` is limited to 5 attempts per minute per IP
 * (`ThrottlerGuard`), and every request here comes from 127.0.0.1. Global
 * setup logs in once and the UI login test logs in once per run, so
 * `--repeat-each` would go over the limit. Anything that logs in asks for a
 * slot first; it waits until fewer than MAX_LOGINS_PER_WINDOW logins were
 * made in the last window, whichever process made them.
 */
const WINDOW_MS = 60_000;
const SAFETY_MARGIN_MS = 1_500;
const MAX_LOGINS_PER_WINDOW = 4;
const LOCK_RETRY_MS = 50;
const LOCK_STALE_MS = 10_000;

const RECORD_FILE = path.join(PATHS.stateDir, 'logins.json');
const LOCK_DIR = path.join(PATHS.stateDir, 'logins.lock');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(): Promise<void> {
  for (;;) {
    try {
      fs.mkdirSync(LOCK_DIR);
      return;
    } catch {
      removeStaleLock();
      await sleep(LOCK_RETRY_MS);
    }
  }
}

function removeStaleLock(): void {
  try {
    const ageMs = Date.now() - fs.statSync(LOCK_DIR).mtimeMs;
    if (ageMs > LOCK_STALE_MS) fs.rmSync(LOCK_DIR, { recursive: true });
  } catch {
    // The lock was released in the meantime.
  }
}

function readRecentLogins(now: number): number[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(RECORD_FILE, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (time): time is number =>
        typeof time === 'number' && now - time < WINDOW_MS + SAFETY_MARGIN_MS,
    );
  } catch {
    return [];
  }
}

/** Resolves once a login may be made without hitting the limit, and records it. */
export async function takeLoginSlot(): Promise<void> {
  fs.mkdirSync(PATHS.stateDir, { recursive: true });
  for (;;) {
    await acquireLock();
    let waitMs = 0;
    try {
      const now = Date.now();
      const recent = readRecentLogins(now);
      if (recent.length < MAX_LOGINS_PER_WINDOW) {
        fs.writeFileSync(RECORD_FILE, JSON.stringify([...recent, now]));
        return;
      }
      waitMs = Math.max(recent[0] + WINDOW_MS + SAFETY_MARGIN_MS - now, 0);
    } finally {
      fs.rmSync(LOCK_DIR, { recursive: true, force: true });
    }
    await sleep(waitMs);
  }
}

/** Forgets earlier logins; global setup calls it because the freshly started backend has an empty throttle. */
export function resetLoginRecord(): void {
  fs.rmSync(RECORD_FILE, { force: true });
}
