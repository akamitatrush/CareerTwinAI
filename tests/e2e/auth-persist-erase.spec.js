import { test, expect } from "@playwright/test";

// E2E do fluxo da Fase 1. Requer:
//  - Postgres rodando (docker compose up -d postgres)
//  - `npx prisma migrate dev` aplicado
//  - .env com AUTH_SECRET, DATABASE_URL e AUTH_DEV_CREDENTIALS=true
//  - ANTHROPIC_API_KEY (a rota /api/analyze chama o LLM)
//
// Em ambiente sem isso, este teste e auto-skipado pelo guard inicial.

const HAS_DB = !!process.env.DATABASE_URL;
const HAS_LLM = !!process.env.ANTHROPIC_API_KEY;
const RUN_E2E = HAS_DB && HAS_LLM && process.env.AUTH_DEV_CREDENTIALS === "true";

test.skip(!RUN_E2E, "E2E requer Postgres + AUTH_DEV_CREDENTIALS=true + ANTHROPIC_API_KEY");

const EMAIL = `e2e-${Date.now()}@local.dev`;

test("login dev → diagnostico → persiste → re-login → apagar tudo", async ({ page, request }) => {
  // 1. Login dev (Credentials)
  await page.goto("/entrar");
  await page.getByPlaceholder("dev@local").fill(EMAIL);
  await page.getByRole("button", { name: /Entrar \(dev\)/i }).click();
  await page.waitForURL(/\/meu-gemeo/);
  await expect(page.getByText(/Seu gêmeo, ainda em branco/)).toBeVisible();

  // 2. Cria um diagnostico via API (rapido, evita digitar CV gigante)
  const cv = "Engenheiro de software com 5 anos de experiencia em Python e SQL. ".repeat(5);
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const r = await request.post("/api/analyze", {
    headers: { "content-type": "application/json", cookie: cookieHeader },
    data: { cv, role: "Engenheiro de Dados" },
  });
  expect(r.ok()).toBeTruthy();
  const json = await r.json();
  expect(json.snapshotId).toBeTruthy();
  expect(json.overall).toBeGreaterThanOrEqual(0);
  expect(json.overall).toBeLessThanOrEqual(100);

  // 3. Volta para /meu-gemeo e ve o snapshot
  await page.goto("/meu-gemeo");
  await expect(page.getByText(/Persistido em/)).toBeVisible();

  // 4. Apagar tudo
  await page.goto("/meus-dados");
  await page.getByPlaceholder("APAGAR").fill("APAGAR");
  await page.getByRole("button", { name: /Apagar tudo definitivamente/i }).click();
  await page.waitForURL(/\/\?apagado=1/);

  // 5. Login de novo: deve voltar a "gemeo em branco" (apagou de verdade)
  await page.goto("/entrar");
  await page.getByPlaceholder("dev@local").fill(EMAIL);
  await page.getByRole("button", { name: /Entrar \(dev\)/i }).click();
  await page.waitForURL(/\/meu-gemeo/);
  await expect(page.getByText(/Seu gêmeo, ainda em branco/)).toBeVisible();
});
