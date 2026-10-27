import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  globalTimeout: 180_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
});
