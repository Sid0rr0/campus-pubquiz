#!/usr/bin/env node
// Every spec folder under .scratch/ needs a row in overview.md (open) or
// done.md (finished): /to-tickets adds the row, /implement-spec moves it.
// A spec missing from both is invisible to whoever picks the next spec.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const scratch = join(import.meta.dirname, '..', '.scratch');
const listed = new Set(
  ['overview.md', 'done.md'].flatMap((file) =>
    [
      ...readFileSync(join(scratch, file), 'utf8').matchAll(
        /^\| *([\w-]+) *\|/gm,
      ),
    ].map(([, spec]) => spec),
  ),
);

const missing = readdirSync(scratch, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter(
    (name) => existsSync(join(scratch, name, 'spec.md')) && !listed.has(name),
  );

if (missing.length > 0) {
  console.error(
    `These .scratch specs have no row in .scratch/overview.md or .scratch/done.md:\n${missing
      .map((name) => `  - ${name}`)
      .join(
        '\n',
      )}\nAdd each to overview.md's "Not implemented" table (Spec, Title, Tickets, Blocked by).`,
  );
  process.exit(1);
}
