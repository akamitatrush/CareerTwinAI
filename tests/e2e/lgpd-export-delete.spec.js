import { test, expect } from "@playwright/test";

// LGPD: logado, navega pra /meus-dados e bate /api/me/export. Valida que o
// JSON retornado e bem-formado e contem `user.email` igual ao da sessao.
//
// O delete completo (eraseUserData) ja e coberto pelo
// auth-persist-erase.spec.js — aqui focamos no export.

const HAS_DB = !!process.env.DATABASE_URL;
const HAS_LLM = !!process.env.ANTHROPIC_API_KEY;
const RUN_E2E = HAS_DB && HAS_LLM && process.env.AUTH_DEV_CREDENTIALS === "true";

test.skip(!RUN_E2E, "Requer ambiente E2E (DB + LLM + AUTH_DEV_CREDENTIALS)");

const EMAIL = `e2e-lgpd-${Date.now()}@local.dev`;

test("LGPD export retorna JSON valido com email do usuario logado", async ({ page }) => {
  // Login
  await page.goto("/entrar");
  await page.getByPlaceholder("dev@local").fill(EMAIL);
  await page.getByRole("button", { name: /Entrar \(dev\)/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  // /meus-dados existe e responde 200
  const dadosResp = await page.goto("/meus-dados");
  expect(dadosResp?.ok()).toBeTruthy();
  await expect(page.getByText(/Baixar uma cópia/i)).toBeVisible();

  // Bate o endpoint /api/me/export — reusa os cookies da sessao
  const response = await page.request.get("/api/me/export");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toMatch(/application\/json/);

  // Body e JSON parseavel e tem user.email == EMAIL
  const body = await response.json();
  expect(body).toHaveProperty("user");
  expect(body.user).toHaveProperty("email", EMAIL);
});
