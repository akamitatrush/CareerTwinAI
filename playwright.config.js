import { defineConfig, devices } from "@playwright/test";

// E2E precisa de Postgres acessivel via DATABASE_URL + Mailpit em :1025 + .env
// com AUTH_DEV_CREDENTIALS=true. Subir com: `docker compose up -d` antes.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_DEV_CREDENTIALS: "true",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
