export default {
  // Named explicitly: pnpm's isolated node_modules hides the plugins from Stryker's glob discovery.
  plugins: [
    '@stryker-mutator/vitest-runner',
    '@stryker-mutator/typescript-checker',
  ],
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: ['src/**/*.ts', '!src/__tests__/**', '!src/index.ts'],
  reporters: ['clear-text', 'progress', 'html'],
  // Local audit tool, not a gate: colour the report, never fail the run.
  thresholds: { high: 80, low: 60, break: null },
};
