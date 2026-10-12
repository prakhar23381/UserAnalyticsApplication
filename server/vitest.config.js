import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // The API, against an in-memory MongoDB.
        test: {
          name: 'api',
          include: ['test/**/*.test.js'],
          exclude: ['test/tracker.test.js'],
          globalSetup: ['test/globalSetup.js'],
          setupFiles: ['test/setup.js'],
          // The first run downloads a mongod binary (~100 MB).
          hookTimeout: 120_000,
        },
      },
      {
        // tracker.js, in an emulated browser (happy-dom). No database.
        test: {
          name: 'tracker',
          include: ['test/tracker.test.js'],
        },
      },
    ],
  },
});
