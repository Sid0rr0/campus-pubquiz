/**
 * `pnpm mutate:db`: runs Stryker against the DB-backed specs. Stryker's Jest
 * runner would run the Jest global set-up once per mutant, so this starts the
 * test container once, runs Stryker with its URI, and stops it afterwards,
 * even when Stryker fails or is interrupted. Extra arguments go to Stryker,
 * e.g. `pnpm mutate:db --mutate src/game/state/joker-changes.ts`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import globalSetup from './global-setup'; // relative: runs under ts-node, outside Jest's `@/` mapping
import globalTeardown from './global-teardown';

const STRYKER_ARGS = ['run', 'stryker.db.config.mjs', '--incremental'];

let stryker: ChildProcess | undefined;
let interrupted = false;

// A handler on SIGINT/SIGTERM replaces Node's default exit, so the wrapper
// stays alive to stop the container. Without forwarding, a `kill -INT <wrapper>`
// (which, unlike Ctrl-C, doesn't reach the whole process group) would leave
// Stryker running. Teardown then runs from `main`'s `finally`.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    interrupted = true;
    stryker?.kill(signal);
  });
}

function runStryker(extraArgs: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    if (interrupted) {
      resolve(1);
      return;
    }
    const child = spawn(
      'pnpm',
      ['exec', 'stryker', ...STRYKER_ARGS, ...extraArgs],
      {
        stdio: 'inherit',
      },
    );
    stryker = child;
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  let exitCode = 1;
  try {
    await globalSetup();
    exitCode = await runStryker(process.argv.slice(2));
  } finally {
    // Also runs after a partial setup failure; a teardown error must not
    // replace the error that got us here.
    try {
      await globalTeardown();
    } catch (teardownError: unknown) {
      console.error('Teardown failed:', teardownError);
    }
  }
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
