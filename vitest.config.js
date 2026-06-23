import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.js"],
    environment: "node",
    globals: true,
    // Coverage: relatar lib/ E app/api/ (rotas tem suites unit/api-*.test.js
    // que importam via dynamic import). Sem threshold mínimo — não queremos
    // quebrar build por enquanto, apenas medir progresso.
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "app/api/**"],
      exclude: [
        "**/*.test.js",
        "tests/**",
        "**/node_modules/**",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
