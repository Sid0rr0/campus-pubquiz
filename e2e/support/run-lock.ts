import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './env';

/**
 * One E2E run at a time per clone. Every worktree's run shares the fixed
 * ports and the one E2E database, so a second run waits here instead of
 * stopping the first run's servers. The lock lives in the git common dir,
 * which all worktrees of this clone share.
 */

const POLL_INTERVAL_MS = 2_000;

interface LockHolder {
  pid: number;
  worktree: string;
}

function lockFilePath(): string {
  const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: PATHS.repoRoot,
    encoding: 'utf8',
  }).trim();
  return path.join(path.resolve(PATHS.repoRoot, commonDir), 'e2e-run.lock');
}

const LOCK_FILE = lockFilePath();

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function tryAcquire(): boolean {
  const holder: LockHolder = { pid: process.pid, worktree: PATHS.repoRoot };
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(holder), { flag: 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

/** Undefined while the holder is still writing the file, or once it's gone. */
function readHolder(): LockHolder | undefined {
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as LockHolder;
  } catch {
    return undefined;
  }
}

/** Waits for any other E2E run to finish; clears a lock whose run died without releasing it. */
export async function acquireRunLock(): Promise<void> {
  let hasAnnouncedWait = false;
  while (!tryAcquire()) {
    const holder = readHolder();
    if (holder && !isProcessAlive(holder.pid)) {
      console.log(
        `[e2e] Clearing the run lock left by a dead run (pid ${holder.pid}).`,
      );
      fs.rmSync(LOCK_FILE, { force: true });
      continue;
    }
    if (!hasAnnouncedWait) {
      console.log(
        `[e2e] Another E2E run holds ${LOCK_FILE}` +
          (holder ? ` (pid ${holder.pid}, ${holder.worktree})` : '') +
          '; waiting for it to finish...',
      );
      hasAnnouncedWait = true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** Releases the lock if this process holds it. */
export function releaseRunLock(): void {
  if (readHolder()?.pid === process.pid) {
    fs.rmSync(LOCK_FILE, { force: true });
  }
}
