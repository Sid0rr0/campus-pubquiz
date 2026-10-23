import strykerFiles from './stryker.files.cjs';

export default {
  // Named explicitly: pnpm's isolated node_modules hides the plugins from Stryker's glob discovery.
  plugins: [
    '@stryker-mutator/jest-runner',
    '@stryker-mutator/typescript-checker',
  ],
  testRunner: 'jest',
  jest: { projectType: 'custom', configFile: 'jest.stryker.config.cjs' },
  coverageAnalysis: 'perTest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: strykerFiles.dbFreeSources(),
  reporters: ['clear-text', 'progress', 'html'],
  // Local audit tool, not a gate: colour the report, never fail the run.
  thresholds: { high: 80, low: 60, break: null },
};
