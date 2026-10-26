// Picks the DB-free slice of the backend for mutation testing, from imports,
// so new files land on the right side without editing a list.
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, 'src');

/** A spec needs Postgres if it, or a local helper it imports, reaches the test DB. */
const DB_SPEC_MARKER = /from '[^']*test-db\/|useTestDatabase/;

/** A source file stays out of the mutation set if it talks to the ORM or Nest directly. */
const DB_OR_NEST_IMPORT = /from '(@mikro-orm|@nestjs|@\/db\/|(\.\.?\/)+db\/)/;

/**
 * Reads a file from another workspace by relative path, which doesn't exist
 * from Stryker's sandbox copy under .stryker-tmp/.
 */
const OUTSIDE_WORKSPACE_SPECS = ['import/__tests__/sample-quiz-import.spec.ts'];

const NOT_MUTATED = [
  /\.spec\.ts$/,
  /\/__tests__\//,
  /^test-db\//,
  /^db\/migrations\//,
  /^scripts\//,
  /^(main|instrument)\.ts$/,
  /\.typecheck\.ts$/,
  /\/fixtures\//,
  /^game\/state\/errors\//, // trivial error classes (message/name strings); the only errors/ directory
];

function listTs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTs(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * The local files `file` imports (`@/…` or relative, resolved against the
 * file's own directory). Matches the specifier after `from`, so an import
 * spread over several lines is read like a one-liner.
 */
function localImports(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+'((?:@\/|\.\.?\/)[^']+)'/g)]
    .map(([, spec]) =>
      spec.startsWith('@/')
        ? path.join(SRC, spec.slice(2))
        : path.resolve(path.dirname(file), spec),
    )
    .flatMap((base) => [`${base}.ts`, path.join(base, 'index.ts')])
    .filter((candidate) => fs.existsSync(candidate));
}

function needsDatabase(file, seen = new Set()) {
  if (seen.has(file)) return false;
  seen.add(file);
  if (DB_SPEC_MARKER.test(fs.readFileSync(file, 'utf8'))) return true;
  return localImports(file)
    .filter((imported) => /\/__tests__\/|test-utils/.test(imported))
    .some((helper) => needsDatabase(helper, seen));
}

/** Absolute paths of every spec Stryker's sandbox can run (not the ones reading other workspaces). */
function allSpecs() {
  return listTs(SRC)
    .filter((f) => f.endsWith('.spec.ts'))
    .filter((f) => !OUTSIDE_WORKSPACE_SPECS.includes(path.relative(SRC, f)));
}

/** Absolute paths of the specs that run without the testcontainer. */
function dbFreeSpecs() {
  return allSpecs().filter((f) => !needsDatabase(f));
}

/** The files under `dir` that are not specs, helpers, fixtures or other NOT_MUTATED paths. */
function mutableIn(dir) {
  return listTs(dir).filter(
    (f) => !NOT_MUTATED.some((re) => re.test(path.relative(SRC, f))),
  );
}

/** Source files that at least one DB-free spec imports directly (an `@/…` path or a relative one). */
function directlyImportedByDbFreeSpecs() {
  return new Set(dbFreeSpecs().flatMap(localImports));
}

/** Backend-relative globs of the source files Stryker mutates. */
function dbFreeSources() {
  const covered = directlyImportedByDbFreeSpecs();
  return mutableIn(SRC)
    .filter((f) => !DB_OR_NEST_IMPORT.test(fs.readFileSync(f, 'utf8')))
    .filter((f) => covered.has(f))
    .map((f) => path.relative(__dirname, f));
}

/** Directories whose logic modules (not their plumbing) `mutate:db` mutates. */
const LOGIC_DIRS = [
  'game/socket/',
  'game/live-edit/',
  'game/rest/',
  'ended-sessions-read/',
];

/** Individual files `mutate:db` mutates that no directory or suffix rule picks. */
const LOGIC_FILES = [
  'game/game.gateway.ts',
  'standings/cell-points.ts',
  'auth/password-hash.ts',
  'feedback/feedback-off-reason.ts',
];

/** Plumbing kept out of the logic directories: Nest wiring, types, wire declarations, validation schemas, HTTP error mappers. */
const NOT_LOGIC =
  /(\.controller|\.guard|\.decorator|\.module|\.types|\.schemas?|\.typecheck|-declarations|-http(-errors)?)\.ts$/;

/** Whether `mutate:db` mutates the file (a path relative to src/) because of its role, not its directory alone. */
function isDbMutateTarget(rel) {
  if (rel === 'app.service.ts' || rel.startsWith('db/')) return false;
  if (rel.endsWith('.service.ts')) return true;
  if (LOGIC_FILES.includes(rel)) return true;
  return LOGIC_DIRS.some((dir) => rel.startsWith(dir)) && !NOT_LOGIC.test(rel);
}

/**
 * Backend-relative paths of the source files `mutate:db` mutates: `game/state/`
 * plus the services and other logic modules picked by role, minus the files
 * the DB-free slice already mutates.
 */
function dbSources() {
  const dbFree = new Set(dbFreeSources());
  const picked = [
    ...mutableIn(path.join(SRC, 'game/state')),
    ...mutableIn(SRC).filter((f) => isDbMutateTarget(path.relative(SRC, f))),
  ].map((f) => path.relative(__dirname, f));
  // game/state/*.service.ts is picked by both rules, so dedupe.
  return [...new Set(picked)].filter((f) => !dbFree.has(f)).sort();
}

module.exports = { dbFreeSpecs, dbFreeSources, allSpecs, dbSources };
