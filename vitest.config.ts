import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Solo tests unitarios: los end-to-end (e2e/) los ejecuta Playwright.
    include: ["tests/**/*.test.ts"],
  },
});
