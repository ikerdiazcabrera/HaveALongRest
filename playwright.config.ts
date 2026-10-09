import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * Tests end-to-end contra un build de producción con datos de demo.
 * Usan su propia base de datos PGlite (.data/pglite-e2e): no tocan la de desarrollo.
 *   npm run test:e2e
 *   PW_CHANNEL=msedge npm run test:e2e   (usar el Edge/Chrome instalado en vez de descargar Chromium)
 */
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) },
    },
  ],
  webServer: {
    command: `npm run db:reset && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { PGLITE_DIR: ".data/pglite-e2e" },
  },
});
