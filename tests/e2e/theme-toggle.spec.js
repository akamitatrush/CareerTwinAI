import { test, expect } from "@playwright/test";

// Toggle theme: valida que mudar de light->dark via .theme-toggle altera o
// atributo data-theme do <html>, e que o tema persiste entre navegacao e
// reload (localStorage ct_theme).

const HAS_DB = !!process.env.DATABASE_URL;
const HAS_LLM = !!process.env.ANTHROPIC_API_KEY;
const RUN_E2E = HAS_DB && HAS_LLM && process.env.AUTH_DEV_CREDENTIALS === "true";

test.skip(!RUN_E2E, "Requer ambiente E2E (DB + LLM + AUTH_DEV_CREDENTIALS)");

const EMAIL = `e2e-theme-${Date.now()}@local.dev`;

test("toggle theme persiste entre paginas e reload", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByPlaceholder("dev@local").fill(EMAIL);
  await page.getByRole("button", { name: /Entrar \(dev\)/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  // O ThemeToggle so renderiza apos mounted=true (evita flash SSR). Esperamos
  // ele aparecer antes de validar o data-theme.
  await page.locator(".theme-toggle").waitFor({ state: "visible" });

  // Tema inicial e "light" (default em ThemeToggle.js quando sem localStorage)
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Click no toggle -> deve virar dark
  await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Navega — preserva
  await page.goto("/gaps");
  await page.locator(".theme-toggle").waitFor({ state: "visible" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Reload — localStorage persiste
  await page.reload();
  await page.locator(".theme-toggle").waitFor({ state: "visible" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
