import { test, expect } from "@playwright/test";

// Login dev -> redireciona pra /dashboard (via /meu-gemeo, que faz redirect)
// e valida que a AppShell renderiza com os items principais de navegacao.
//
// Requer ambiente E2E completo (DB + LLM + AUTH_DEV_CREDENTIALS=true).

const HAS_DB = !!process.env.DATABASE_URL;
const HAS_LLM = !!process.env.ANTHROPIC_API_KEY;
const RUN_E2E = HAS_DB && HAS_LLM && process.env.AUTH_DEV_CREDENTIALS === "true";

test.skip(
  !RUN_E2E,
  "E2E requer Postgres + AUTH_DEV_CREDENTIALS=true + ANTHROPIC_API_KEY"
);

const EMAIL = `e2e-login-${Date.now()}@local.dev`;

test("login dev -> dashboard com AppShell", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByPlaceholder("dev@local").fill(EMAIL);
  await page.getByRole("button", { name: /Entrar \(dev\)/i }).click();

  // /meu-gemeo agora e redirect pra /dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  // AppShell visivel (sidebar em desktop OU header em mobile)
  await expect(
    page.locator(".appshell-sidebar, .appshell-mobile-header").first()
  ).toBeVisible();

  // Nav items principais (sidebar OU mobile nav)
  await expect(page.getByRole("link", { name: /Dashboard/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Análise de gaps/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Radar de vagas/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Plano$/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Transparência/i }).first()).toBeVisible();
});
