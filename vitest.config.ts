import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@mycelium/contracts": new URL(
        "./packages/contracts/src/index.ts",
        import.meta.url,
      ).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      "@mycelium/sentinel": new URL(
        "./packages/sentinel/src/index.ts",
        import.meta.url,
      ).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    },
  },
});
