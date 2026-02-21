import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "data", "scripts", "e2e"],
    environmentMatchGlobs: [
      ["app/api/**/*.test.ts", "node"],
      ["lib/**/*.test.ts", "node"],
    ],
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**", "components/**"],
      exclude: ["**/*.test.*", "test/**"],
    },
  },
});
