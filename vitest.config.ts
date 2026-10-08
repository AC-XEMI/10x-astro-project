import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure modules only (no Astro runtime, no Supabase). The include is narrowed to
// src/ so Vitest does not pick up the toolkit's own *.test.mjs files under .claude/ or .ds-sync/.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
