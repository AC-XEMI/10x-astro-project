import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against a local Supabase (`npx supabase start`) and a running app at BASE_URL.
// Kept out of vitest.config.ts so `npm test` and Stryker never need a database.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.int.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    // Files share the accounts created in globalSetup and A's data.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
