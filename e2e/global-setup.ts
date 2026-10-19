import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { request } from '@playwright/test';
import { saveAdminStorageState } from './support/api';
import { recreateE2eDatabase } from './support/database';
import {
  BACKEND_URL,
  DATABASE_URL,
  FUN_FACT_START_DELAY_MS,
  NEXT_DIST_DIR,
  PATHS,
  SHOULD_SKIP_BUILD,
} from './support/env';
import { resetLoginRecord } from './support/login-budget';
import { backend, frontend } from './support/servers';

const MAX_CAPTURED_OUTPUT_BYTES = 64 * 1024 * 1024;

interface RunOptions {
  cwd: string;
  env?: Record<string, string>;
  /** Keeps the command's output unless it fails (the migration logs every SQL statement). */
  isQuiet?: boolean;
}

function run(command: string, args: string[], options: RunOptions): void {
  try {
    execFileSync(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.isQuiet ? 'pipe' : 'inherit',
      maxBuffer: MAX_CAPTURED_OUTPUT_BYTES,
    });
  } catch (error) {
    if (options.isQuiet && error instanceof Error) {
      const { stdout, stderr } = error as Error & {
        stdout?: Buffer;
        stderr?: Buffer;
      };
      console.error(`${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`);
    }
    throw error;
  }
}

/** E2E_SKIP_BUILD reuses earlier builds; stop with a clear message when one is gone. */
function assertEarlierBuildsExist(): void {
  const builds = [
    path.join(PATHS.backendDir, 'dist', 'scripts', 'migrate.js'),
    path.join(PATHS.backendDir, 'dist', 'main.js'),
    path.join(PATHS.frontendDir, NEXT_DIST_DIR),
  ];
  const missing = builds.filter((build) => !fs.existsSync(build));
  if (missing.length > 0) {
    throw new Error(
      `E2E_SKIP_BUILD=1 but there is no earlier build (missing: ${missing.join(', ')}).\n` +
        'Run without E2E_SKIP_BUILD to build both apps first.',
    );
  }
}

function buildApps(): void {
  if (SHOULD_SKIP_BUILD) {
    assertEarlierBuildsExist();
    console.log('[e2e] E2E_SKIP_BUILD=1: using the earlier builds.');
    return;
  }
  console.log('[e2e] Building shared types, backend and frontend...');
  run('pnpm', ['--filter', '@campus-pubquiz/types', 'build'], {
    cwd: PATHS.repoRoot,
  });
  // The incremental build cache outlives dist/: with a deleted dist it says "up to date" and emits nothing.
  fs.rmSync(path.join(PATHS.backendDir, 'tsconfig.build.tsbuildinfo'), {
    force: true,
  });
  // nest build never deletes old output, so a migration compiled on another branch would still be applied.
  fs.rmSync(path.join(PATHS.backendDir, 'dist', 'db', 'migrations'), {
    recursive: true,
    force: true,
  });
  run('pnpm', ['--filter', 'backend', 'build'], { cwd: PATHS.repoRoot });
  run('pnpm', ['--filter', 'frontend', 'build'], {
    cwd: PATHS.repoRoot,
    env: {
      NEXT_DIST_DIR,
      NEXT_PUBLIC_BACKEND_URL: BACKEND_URL,
      NEXT_PUBLIC_FUN_FACT_START_DELAY_MS: String(FUN_FACT_START_DELAY_MS),
    },
  });
}

function migrateDatabase(): void {
  console.log('[e2e] Applying migrations to the E2E database...');
  run(process.execPath, ['dist/scripts/migrate.js'], {
    cwd: PATHS.backendDir,
    env: { DATABASE_URL },
    isQuiet: true,
  });
}

/** Builds both apps, resets the E2E database, starts both servers and logs the quiz master in once. */
export default async function globalSetup(): Promise<void> {
  // Stop servers a crashed earlier run left behind, then start from nothing.
  await Promise.all([backend.stop(), frontend.stop()]);
  fs.rmSync(PATHS.stateDir, { recursive: true, force: true });
  fs.rmSync(PATHS.logDir, { recursive: true, force: true });
  resetLoginRecord();

  // First, so a stopped Postgres fails the run before the slow builds.
  await recreateE2eDatabase();
  buildApps();
  migrateDatabase();

  try {
    console.log('[e2e] Starting the backend (:3001) and frontend (:8889)...');
    await backend.start();
    await frontend.start();
    await saveAdminStorageState(request);
  } catch (error) {
    // A failed setup skips the teardown, so don't leave servers running.
    await Promise.all([backend.stop(), frontend.stop()]);
    throw error;
  }
}
