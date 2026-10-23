import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A Stryker run that crashes leaves its sandbox copy of the tests behind.
    exclude: [...configDefaults.exclude, '.stryker-tmp/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
