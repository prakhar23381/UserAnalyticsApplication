import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    globalSetup: ['test/globalSetup.js'],
    setupFiles: ['test/setup.js'],
    // The first run downloads a mongod binary (~100 MB).
    hookTimeout: 120_000,
  },
});
