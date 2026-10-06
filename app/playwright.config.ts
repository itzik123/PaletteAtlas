import { defineConfig, devices } from '@playwright/test';

/** Where `vite preview` serves the production build while the tests run. */
const PREVIEW_PORT = 4173;
const inCi = Boolean(process.env.CI);

/** UI tests run against the production build, the site as it ships. */
export default defineConfig({
  testDir: 'e2e',
  // The Atlas's tests run on a gallery the pipeline builds from its fixture (see fixture-gallery.ts).
  globalSetup: './e2e/fixture-gallery.ts',
  forbidOnly: inCi,
  reporter: inCi ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PREVIEW_PORT}` },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `vite build && vite preview --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
  },
});
