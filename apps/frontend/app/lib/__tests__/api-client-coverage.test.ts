import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every exported request function in `app/lib/*-api.ts` must be a case in a
 * `*.contract.test.ts`, so the contract harness pins its exact request,
 * including the CSRF header on a cookie-authenticated write. A case name may
 * carry a variant suffix: `fetchQuizPreview (with jokers)`.
 */

// Vitest runs from the workspace root (`apps/frontend`).
const LIB_DIR = join(process.cwd(), 'app/lib');
const TESTS_DIR = join(LIB_DIR, '__tests__');

/** Clients with their own spec instead of a contract case, and why. */
const EXEMPT: Record<string, string> = {
  // A FormData body can't be compared by the harness's exact-init assertion;
  // media-api.test.ts checks the request, CSRF header included.
  uploadMedia: 'media-api.test.ts',
};

function exportedFunctions(source: string): string[] {
  return [...source.matchAll(/^export (?:async )?function (\w+)/gm)].map(
    (m) => m[1],
  );
}

const contractCaseNames = new Set(
  readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.contract.test.ts'))
    .flatMap((f) => [
      ...readFileSync(join(TESTS_DIR, f), 'utf8').matchAll(/name: '(\w+)[' ]/g),
    ])
    .map((m) => m[1]),
);

const apiModules = readdirSync(LIB_DIR).filter((f) => f.endsWith('-api.ts'));

describe('API client contract coverage', () => {
  it.each(apiModules)('%s has a contract case per exported function', (f) => {
    const missing = exportedFunctions(
      readFileSync(join(LIB_DIR, f), 'utf8'),
    ).filter((fn) => !contractCaseNames.has(fn) && !(fn in EXEMPT));

    expect(missing).toEqual([]);
  });
});
