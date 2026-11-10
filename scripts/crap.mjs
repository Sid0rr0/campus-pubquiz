#!/usr/bin/env node
// CRAP score report (complexity × missing coverage) via unclebob/crapper.
//   node scripts/crap.mjs            every workspace: rerun coverage, rank all functions
//   node scripts/crap.mjs --changed  only uncommitted source files; coverage from only the tests that import them
// Exits 2 when any scored function is above THRESHOLD, and always ends on a `crap: exit <code>` line
// (wait on that line for a backgrounded run). Backend coverage needs Docker (Testcontainers).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRAPPER_SHA = '6fd92c4c9bcc56efb64a2f8743d5a2993bcfd42d';
// crapper's own launcher installs these unpinned; a new parser release could shift scores.
const PY_DEPS = ['tree-sitter==0.26.0', 'tree-sitter-language-pack==1.23.1'];
const THRESHOLD = '10';
const TOOL = join(ROOT, '.tools', 'crapper');
const VENV_OK = join(TOOL, '.venv', '.installed');

const zeroThresholds = ['lines', 'functions', 'branches', 'statements'].map(
  (k) => `--coverage.thresholds.${k}=0`,
);
// `related` (Vitest) and --findRelatedTests (Jest) follow the import graph, so every test that can reach a file runs.
const vitest = (name) => (related) => [
  'vitest',
  ...(related
    ? ['related', '--run', '--passWithNoTests', ...related]
    : ['run']),
  '--coverage',
  '--coverage.reporter=lcov',
  `--coverage.reportsDirectory=${join(ROOT, 'coverage', name)}`,
  ...zeroThresholds,
];
// crapper only reads LCOV from <root>/coverage/**, so each workspace writes there.
const WORKSPACES = [
  {
    name: 'shared-types',
    dir: 'shared/types',
    src: 'shared/types/src',
    cmd: vitest('shared-types'),
  },
  {
    name: 'backend',
    dir: 'apps/backend',
    src: 'apps/backend/src',
    cmd: (related) => [
      'jest',
      ...(related
        ? ['--passWithNoTests', '--findRelatedTests', ...related]
        : []),
      '--maxWorkers=2',
      '--coverage',
      '--coverageReporters=lcov',
      `--coverageDirectory=${join(ROOT, 'coverage', 'backend')}`,
    ],
  },
  {
    name: 'frontend',
    dir: 'apps/frontend',
    src: 'apps/frontend/app',
    cmd: vitest('frontend'),
  },
];

const isTest = (p) =>
  /(^|\/)(__tests__|test|tests|spec|specs)\//.test(p) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
const isSource = (p) =>
  /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p) && !p.endsWith('.d.ts') && !isTest(p);

function run(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

function exit(code) {
  console.log(`crap: exit ${code}`);
  process.exit(code);
}

function must(cmd, args, cwd) {
  const code = run(cmd, args, cwd);
  if (code !== 0) {
    console.error(`crap: \`${cmd} ${args.join(' ')}\` exited ${code}`);
    exit(1);
  }
}

function ensureCrapper() {
  const head = existsSync(TOOL)
    ? spawnSync('git', ['-C', TOOL, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).stdout.trim()
    : '';
  if (head !== CRAPPER_SHA) {
    rmSync(TOOL, { recursive: true, force: true });
    must('git', [
      'clone',
      '-q',
      'https://github.com/unclebob/crapper.git',
      TOOL,
    ]);
    must('git', ['-C', TOOL, 'checkout', '-q', CRAPPER_SHA]);
  }
  // A half-built venv (interrupted install) is rebuilt; crapper's launcher can't recover from one.
  if (!existsSync(VENV_OK)) {
    rmSync(join(TOOL, '.venv'), { recursive: true, force: true });
    must('python3', ['-m', 'venv', join(TOOL, '.venv')]);
    const pip = join(TOOL, '.venv', 'bin', 'pip');
    must(pip, ['install', '-q', ...PY_DEPS]);
    must(pip, ['install', '-q', '--no-deps', '-e', TOOL]);
    writeFileSync(VENV_OK, CRAPPER_SHA);
  }
}

function changedSources() {
  const out = execFileSync(
    'git',
    [
      'status',
      '--porcelain',
      '--no-renames',
      '--untracked-files=all',
      '--',
      ...WORKSPACES.map((w) => w.src),
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .map((line) => line.slice(3).replace(/^"|"$/g, ''))
    .filter((p) => p && isSource(p) && existsSync(join(ROOT, p)));
}

const changed = process.argv.includes('--changed');
const files = changed ? changedSources() : null;
if (changed && files.length === 0) {
  console.log('crap: no uncommitted source changes to score.');
  exit(0);
}
const workspaces = changed
  ? WORKSPACES.filter((w) => files.some((f) => f.startsWith(`${w.src}/`)))
  : WORKSPACES;

ensureCrapper();
for (const w of workspaces) {
  console.log(`crap: coverage for ${w.name}`);
  // A failed run leaves no report (Vitest clears it first), so every function would score 0% covered.
  const related = files
    ?.filter((f) => f.startsWith(`${w.src}/`))
    .map((f) => join(ROOT, f));
  if (run('pnpm', ['exec', ...w.cmd(related)], join(ROOT, w.dir)) !== 0) {
    console.error(
      `crap: ${w.name} tests failed, so its scores would be wrong. Fix the tests and rerun.`,
    );
    exit(1);
  }
}

const code = run(join(TOOL, '.venv', 'bin', 'python'), [
  '-m',
  'crapper',
  '--use-existing-coverage',
  '--threshold',
  THRESHOLD,
  ...(changed ? files : WORKSPACES.map((w) => w.src)),
]);
exit(code);
