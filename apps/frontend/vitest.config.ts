import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Parallel agent runs load the machine enough that unbounded workers time
// tests out at random; half the cores keeps most of the speed. CI keeps
// Vitest's default.
const LOCAL_MAX_WORKERS = '50%';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  test: {
    environment: 'happy-dom',
    // Keep the suite offline even if a happy-dom upgrade changes a default
    // (the /display media spec renders a YouTube embed).
    environmentOptions: {
      happyDOM: {
        settings: {
          disableIframePageLoading: true,
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
        },
      },
    },
    setupFiles: ['./vitest.setup.ts'],
    maxWorkers: process.env.CI ? undefined : LOCAL_MAX_WORKERS,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: ['app/**/*.test.{ts,tsx}', 'app/layout.tsx', 'app/page.tsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
