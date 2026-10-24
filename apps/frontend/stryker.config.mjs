import { fileURLToPath } from 'node:url';

// The sandbox copy of this workspace sits deeper in the tree, so vitest.config.ts can't
// find shared/types by a relative path; the child processes inherit this variable.
process.env.SHARED_TYPES_ENTRY = fileURLToPath(
  new URL('../../shared/types/src/index.ts', import.meta.url),
);

export default {
  // Named explicitly: pnpm's isolated node_modules hides the plugins from Stryker's glob discovery.
  plugins: [
    '@stryker-mutator/vitest-runner',
    '@stryker-mutator/typescript-checker',
  ],
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  coverageAnalysis: 'perTest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  // Non-component modules only: in .tsx, most survivors would be Tailwind classes and display copy.
  // Checked: the `[id]` quiz editor and stats paths still match these globs.
  mutate: [
    'app/**/*.ts',
    '!app/**/*.test.ts',
    '!app/**/*.d.ts',
    '!app/**/__tests__/**',
  ],
  // Capped: the default (one per core) runs ~13 processes and fills swap on a 24 GB laptop.
  // The Vitest runner pins each worker to one Vitest worker, so maxWorkers doesn't multiply.
  concurrency: 8,
  reporters: ['clear-text', 'progress', 'html'],
  // Local audit tool, not a gate: colour the report, never fail the run.
  thresholds: { high: 80, low: 60, break: null },
};
