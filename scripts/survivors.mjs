#!/usr/bin/env node
// Lists the mutants no test killed (Survived, NoCoverage), one line each, from Stryker's
// incremental reports (they hold every mutant's status and the file source).
//   node scripts/survivors.mjs                    every workspace's reports/*incremental*.json
//   node scripts/survivors.mjs <report.json> ...  only these reports
// Several reports can cover one source file (DB-free, mutate:db areas, mutate:changed);
// the newest report wins for that file.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACES = ['shared/types', 'apps/backend', 'apps/frontend'];
const UNKILLED = new Set(['Survived', 'NoCoverage']);

function defaultReports() {
  return WORKSPACES.flatMap((ws) => {
    const dir = join(ROOT, ws, 'reports');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.includes('incremental') && f.endsWith('.json'))
      .map((f) => join(dir, f));
  });
}

/** source file (repo-relative) → { report, entry }, newest report first. */
function newestPerFile(reports) {
  const byFile = new Map();
  const sorted = reports
    .map((path) => ({ path, mtime: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { path } of sorted) {
    // A report sits in <workspace>/reports/, and its file keys are workspace-relative.
    const workspace = dirname(dirname(path));
    const { files } = JSON.parse(readFileSync(path, 'utf8'));
    for (const [file, entry] of Object.entries(files)) {
      const key = relative(ROOT, join(workspace, file));
      if (!byFile.has(key)) byFile.set(key, entry);
    }
  }
  return byFile;
}

function originalText(source, { start, end }) {
  const lines = source.split('\n').slice(start.line - 1, end.line);
  lines[lines.length - 1] = lines[lines.length - 1].slice(0, end.column - 1);
  lines[0] = lines[0].slice(start.column - 1);
  return oneLine(lines.join('\n'));
}

const oneLine = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat;
};

const reports = process.argv.slice(2).length
  ? process.argv.slice(2)
  : defaultReports();
const counts = {};
for (const [file, entry] of [...newestPerFile(reports)].sort()) {
  for (const m of entry.mutants.sort(
    (a, b) => a.location.start.line - b.location.start.line,
  )) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
    if (!UNKILLED.has(m.status)) continue;
    const before = originalText(entry.source, m.location);
    const after = oneLine(m.replacement ?? '');
    console.log(
      `${file}:${m.location.start.line}  ${m.status === 'NoCoverage' ? 'NoCoverage ' : ''}${m.mutatorName}  ${before}  →  ${after}`,
    );
  }
}
const summary = Object.entries(counts).map(([status, n]) => `${status} ${n}`);
console.log(`\n${summary.join(', ') || 'No mutants in these reports.'}`);
