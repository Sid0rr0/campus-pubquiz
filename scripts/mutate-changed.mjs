#!/usr/bin/env node
// Mutation-tests only the source files changed since <base>, then lists the survivors with
// scripts/survivors.mjs. <base> defaults to the commit of the last successful run (recorded in
// .logs/mutate-changed/last-run.json), else origin/main.
//   node scripts/mutate-changed.mjs [base]          run
//   node scripts/mutate-changed.mjs [base] --list   print the files each run would mutate, run nothing
// Keeps each workspace's own file selection: `--mutate` replaces a config's globs rather than
// filtering them, so changed files are matched against those globs (shared/types, frontend) or the
// backend's stryker.files.cjs lists. Runs one at a time (each Stryker run uses 8 workers), each
// logged to .logs/mutate-changed/<run>.log. Results go to their own `*-changed.json` incremental
// files, so a subset run never wipes the full runs' results. The backend's DB-backed run needs Docker.
import { execFileSync, spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, matchesGlob } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(ROOT, '.logs', 'mutate-changed');
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const LAST_RUN = join(LOG_DIR, 'last-run.json');
const lastRun = existsSync(LAST_RUN)
  ? JSON.parse(readFileSync(LAST_RUN, 'utf8'))
  : null;
const base =
  args.find((a) => !a.startsWith('--')) ?? lastRun?.sha ?? 'origin/main';

const git = (...a) =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
/** Marks everything up to HEAD as mutation-tested, so the next run starts here. */
function recordRun() {
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(
    LAST_RUN,
    JSON.stringify({ sha: head, date: new Date().toISOString() }) + '\n',
  );
}
// Against the merge base and the working tree, so uncommitted edits count too.
const changed = git(
  'diff',
  '--name-only',
  '--diff-filter=d',
  git('merge-base', base, 'HEAD'),
)
  .split('\n')
  .filter(Boolean);

/** Workspace-relative changed files that match a Stryker `mutate` list ('!' entries exclude). */
function pick(ws, mutate) {
  const include = mutate.filter((g) => !g.startsWith('!'));
  const exclude = mutate
    .filter((g) => g.startsWith('!'))
    .map((g) => g.slice(1));
  return changed
    .filter((f) => f.startsWith(`${ws}/`))
    .map((f) => f.slice(ws.length + 1))
    .filter(
      (f) =>
        include.some((g) => matchesGlob(f, g)) &&
        !exclude.some((g) => matchesGlob(f, g)),
    );
}

const configMutate = async (ws) =>
  (await import(pathToFileURL(join(ROOT, ws, 'stryker.config.mjs')))).default
    .mutate;
const backendLists = createRequire(import.meta.url)(
  join(ROOT, 'apps/backend/stryker.files.cjs'),
);
const inBackend = (list) => {
  const wanted = new Set(list);
  return pick('apps/backend', ['src/**/*.ts']).filter((f) => wanted.has(f));
};
// `mutate:db` is a wrapper that starts the test database and adds `run stryker.db.config.mjs --incremental`.
const command = (run) => [
  ...(run.db ? ['mutate:db'] : ['exec', 'stryker', 'run', '--incremental']),
  '--incrementalFile',
  `reports/${run.report}`,
  '--mutate',
  // A path like `quizzes/[id]/` is a glob class to Stryker; `[[]` and `[]]` match the brackets.
  run.files.map((f) => f.replace(/[[\]]/g, (c) => `[${c}]`)).join(','),
];

const runs = [
  {
    name: 'shared-types',
    ws: 'shared/types',
    files: pick('shared/types', await configMutate('shared/types')),
    report: 'stryker-incremental-changed.json',
  },
  {
    name: 'backend',
    ws: 'apps/backend',
    files: inBackend(backendLists.dbFreeSources()),
    report: 'stryker-incremental-changed.json',
  },
  {
    name: 'backend-db',
    ws: 'apps/backend',
    files: inBackend(backendLists.dbSources()),
    report: 'stryker-db-incremental-changed.json',
    db: true,
  },
  {
    name: 'frontend',
    ws: 'apps/frontend',
    files: pick('apps/frontend', await configMutate('apps/frontend')),
    report: 'stryker-incremental-changed.json',
  },
].filter((run) => run.files.length > 0);

console.log(
  `Base: ${base}${base === lastRun?.sha ? ` (last run ${lastRun.date.slice(0, 10)})` : ''}, changed since then: ${changed.length} file(s)`,
);
if (runs.length === 0) {
  console.log(`No mutated source file changed since ${base}.`);
  if (!listOnly) recordRun();
  process.exit(0);
}
if (listOnly) {
  for (const run of runs) console.log(`${run.name}: ${run.files.join(' ')}`);
  process.exit(0);
}

function runStryker(run) {
  const log = join(LOG_DIR, `${run.name}.log`);
  console.log(`${run.name}: ${run.files.length} file(s), log ${log}`);
  const out = createWriteStream(log);
  const child = spawn('pnpm', command(run), { cwd: join(ROOT, run.ws) });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  return new Promise((resolve) =>
    child.on('close', (code) => out.end(() => resolve({ code, log }))),
  );
}

mkdirSync(LOG_DIR, { recursive: true });
let failed = false;
for (const run of runs) {
  const { code, log } = await runStryker(run);
  const score = readFileSync(log, 'utf8')
    .split('\n')
    .find((line) => line.startsWith('All files'));
  console.log(
    `  ${code === 0 ? (score ?? 'done') : `FAILED (exit ${code}), see the log`}`,
  );
  failed ||= code !== 0;
}

console.log('\nSurvivors:');
const reports = runs
  .map((run) => join(ROOT, run.ws, 'reports', run.report))
  .filter(existsSync);
if (reports.length > 0)
  execFileSync(
    process.execPath,
    [join(ROOT, 'scripts/survivors.mjs'), ...new Set(reports)],
    { stdio: 'inherit' },
  );
// A failed run (e.g. Docker down for backend-db) keeps the old base, so its files are retried.
if (!failed) recordRun();
process.exit(failed ? 1 : 0);
