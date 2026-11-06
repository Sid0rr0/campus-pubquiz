/**
 * `pnpm mutate:db:areas [area ...]`: runs `mutate:db` one area at a time
 * (a top-level src/ folder; game/ split by subfolder), each logging to
 * `.logs/mutate-db/<area>.log` at the repo root. A finished area keeps its
 * results even when a later one is interrupted. Each area has its own
 * incremental file, because Stryker rewrites that file with only the mutants
 * of the current run. With no arguments it runs every area; `--list` prints them.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';

const BACKEND = path.resolve(__dirname, '../..');
const LOG_DIR = path.resolve(BACKEND, '../../.logs/mutate-db');

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the file list is CommonJS, shared with the Stryker configs
const { dbSources } = require(path.join(BACKEND, 'stryker.files.cjs')) as {
  dbSources: () => string[];
};

/** `src/game/state/x.ts` → `game-state`; `src/game/game.gateway.ts` → `game`; `src/auth/x.ts` → `auth`. */
export function areaOf(file: string): string {
  const [top, sub, rest] = file.replace(/^src\//, '').split('/');
  return top === 'game' && rest !== undefined ? `game-${sub}` : top;
}

export function groupByArea(files: string[]): Map<string, string[]> {
  const areas = new Map<string, string[]>();
  for (const file of files) {
    const area = areaOf(file);
    areas.set(area, [...(areas.get(area) ?? []), file]);
  }
  return areas;
}

function runArea(area: string, files: string[]): Promise<number> {
  const log = createWriteStream(path.join(LOG_DIR, `${area}.log`));
  const child = spawn(
    'pnpm',
    [
      'mutate:db',
      '--mutate',
      files.join(','),
      '--incrementalFile',
      `reports/stryker-db-incremental-v2-${area}.json`,
    ],
    { cwd: BACKEND },
  );
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return new Promise((resolve) => {
    child.on('close', (code) => log.end(() => resolve(code ?? 1)));
  });
}

async function main(): Promise<void> {
  let interrupted = false;
  // Ctrl-C reaches the child's process group too; this only stops later areas from starting.
  process.on('SIGINT', () => (interrupted = true));
  process.on('SIGTERM', () => (interrupted = true));
  const areas = groupByArea(dbSources());
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    for (const [area, files] of areas) console.log(`${area} (${files.length})`);
    return;
  }
  const unknown = args.filter((a) => !areas.has(a));
  if (unknown.length > 0) {
    console.error(`Unknown area(s): ${unknown.join(', ')}. Run with --list.`);
    process.exit(1);
  }
  const picked = args.length > 0 ? args : [...areas.keys()];
  mkdirSync(LOG_DIR, { recursive: true });
  let failed = false;
  for (const area of picked) {
    if (interrupted) break;
    const started = Date.now();
    console.log(
      `${area}: running, log in ${path.join(LOG_DIR, `${area}.log`)}`,
    );
    const code = await runArea(area, areas.get(area) ?? []);
    const minutes = Math.round((Date.now() - started) / 60_000);
    console.log(
      `${area}: ${code === 0 ? 'done' : `failed (exit ${code})`} in ${minutes} min`,
    );
    failed ||= code !== 0;
  }
  process.exit(failed || interrupted ? 1 : 0);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
