import { defineConfig } from 'vitest/config';

// Keep Playwright's extension journeys out of the unit-test runner.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
