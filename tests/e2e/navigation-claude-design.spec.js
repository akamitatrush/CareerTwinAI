import { test, expect } from "@playwright/test";

// Navega entre as 5 telas Claude Design (gaps, oportunidades, plano,
// transparencia, conta) e valida que cada uma renderiza um container
// principal (main ou .app-container — /conta usa <div> hoje).

const HAS_DB = !!process.env.DATABASE_URL;
const HAS_LLM = !!process.env.ANTHROPIC_API_KEY;
const RUN_E2E = HAS_DB && HAS_LLM && process.env.AUTH_DEV_CREDENTIALS === "true";

test.skip(!RUN_E2E, "Requer ambiente E2E (DB + LLM + AUTH_DEV_CREDENTIALS)");

const EMAIL = `e2e-nav-${Date.now()}@local.dev`;

test("navega entre 5 telas Claude Design", async ({ page }) => {
  // Login
  await page.goto("/entrar");
  await page.getByPlaceholder("dev@local").fill(EMAIL);
  await page.getByRole("button", { name: /Entrar \(dev\)/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  const routes = ["/gaps", "/oportunidades", "/plano", "/transparencia", "/conta"];
  for (const route of routes) {
    await page.goto(route);
    // Cada tela tem <main id="main-content"> OU (no caso de /conta) um
    // .app-container dentro de uma <div>. Aceita ambos pra cobrir todas.
    await expect(
      page.locator("main#main-content, main, .app-container").first()
    ).toBeVisible({ timeout: 5_000 });
  }
});
