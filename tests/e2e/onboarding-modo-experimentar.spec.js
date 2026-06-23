import { test, expect } from "@playwright/test";

// Home `/` mostra o split-panel de onboarding (brand esquerda, input direita)
// e o "modo experimentar" funciona sem login (botao Carregar exemplo
// preenche o textarea de CV).
//
// Esse spec NAO depende de auth/DB/LLM — roda contra a home publica.
// Mantemos um skip leve so caso o webServer falhe (ainda assim, sem DB/LLM
// a home renderiza normalmente).

test("home / mostra split-panel onboarding", async ({ page }) => {
  await page.goto("/");

  // Brand panel esquerda
  await expect(page.locator(".ct-onb-brand").first()).toBeVisible();
  await expect(page.getByText(/CareerTwin AI/).first()).toBeVisible();

  // Input panel direita
  await expect(page.locator(".ct-onb-input").first()).toBeVisible();
  await expect(page.locator("textarea#cvText")).toBeVisible();
  await expect(page.locator("input#roleText")).toBeVisible();

  // CTA — pode ser "Gerar diagnostico (efemero)" ou "Gerar e salvar..."
  // dependendo de login. Sem login, e o "efemero".
  await expect(
    page.getByRole("button", { name: /Gerar diagnóstico/i })
  ).toBeVisible();
});

test("carregar exemplo preenche CV (modo experimentar sem login)", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Carregar exemplo/i }).click();

  // Espera CV ser preenchido (>= 60 chars, mesmo treshold do validador na rota)
  const cv = await page.locator("textarea#cvText").inputValue();
  expect(cv.length).toBeGreaterThan(60);

  // Cargo-alvo tambem foi preenchido
  const role = await page.locator("input#roleText").inputValue();
  expect(role.length).toBeGreaterThan(0);
});
