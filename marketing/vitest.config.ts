import { defineConfig } from "vitest/config";

// Smoke/seam tests for the Cloudflare Pages Functions live next to the
// functions they cover (functions/**/*.test.ts).
// URL-contract tests for the checkout JS live under public/**/*.test.js.
export default defineConfig({
  test: {
    include: ["functions/**/*.test.ts", "public/**/*.test.js"],
    environment: "node",
  },
});
