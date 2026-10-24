/**
 * `pnpm mutate:db`: runs Stryker against the DB-backed specs. Stryker's Jest
 * runner would run the Jest global set-up once per mutant, so this starts the
 * test container once, runs Stryker with its URI, and stops it afterwards,
 * even when Stryker fails or is interrupted. Extra arguments go to Stryker,
 * e.g. `pnpm mutate:db --mutate src/game/state/joker-changes.ts`.
 */
import { spawn } from 'node:child_process';
import globalSetup from './global-setup'; // relative: runs under ts-node, outside Jest's `@/` mapping
import globalTeardown from './global-teardown';

const STRYKER_ARGS = ['run', 'stryker.db.config.mjs', '--incremental'];

function runStryker(extraArgs: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      ['exec', 'stryker', ...STRYKER_ARGS, ...extraArgs],
      {
        stdio: 'inherit',
      },
    );
    // Ctrl-C reaches Stryker through the terminal's process group; this
    // process waits for it to exit and then stops the container.
    process.on('SIGINT', () => {});
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  await globalSetup();
  let exitCode = 1;
  try {
    exitCode = await runStryker(process.argv.slice(2));
  } finally {
    await globalTeardown();
  }
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
