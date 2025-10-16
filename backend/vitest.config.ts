import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
    setupFiles: [path.resolve(__dirname, 'test', 'setup', 'globals.ts')],
    coverage: {
      reporter: ['text', 'html', 'json-summary'],
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    testTimeout: 60000,
    hookTimeout: 60000
  }
});
