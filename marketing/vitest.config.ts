import { defineConfig } from "vitest/config";

// Smoke/seam tests for the Cloudflare Pages Functions live next to the
// functions they cover (functions/**/*.test.ts).
export default defineConfig({
  test: {
    include: ["functions/**/*.test.ts"],
    environment: "node",
  },
});
